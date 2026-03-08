"use strict";

const baseUrlRaw = process.env.OPENCLAW_ADMIN_BASE_URL || "";
const token = process.env.OPENCLAW_ADMIN_TOKEN || "";
const args = process.argv.slice(2);
const forceProductIdArg = args.find((arg) => arg.startsWith("--product-id="));
const forceProductId = forceProductIdArg ? forceProductIdArg.split("=")[1] : "";

function getNumberEnv(name, defaultValue) {
  const raw = process.env[name];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

const baseUrl = baseUrlRaw.replace(/\/+$/, "");
const pollIntervalMs = getNumberEnv("SINGLE_OPT_POLL_INTERVAL_MS", 20000);
const maxPollMs = getNumberEnv("SINGLE_OPT_MAX_POLL_MS", 120000);
const requestTimeoutMs = getNumberEnv("SINGLE_OPT_REQUEST_TIMEOUT_MS", 15000);
const retryCount = Math.max(0, Math.floor(getNumberEnv("SINGLE_OPT_RETRY_COUNT", 2)));
const retryDelayMs = getNumberEnv("SINGLE_OPT_RETRY_DELAY_MS", 5000);
const hardTimeoutMs = getNumberEnv("SINGLE_OPT_HARD_TIMEOUT_MS", maxPollMs + 60000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "done") return "done";
  if (value === "failed") return "failed";
  if (value === "pending") return "pending";
  if (value === "in_progress") return "in_progress";
  return value || "unknown";
}

function pickError(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error === "object" && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return "";
}

async function fetchWithRetry(endpoint, options = {}, runtime = {}) {
  const retries = Number.isInteger(runtime.retries) && runtime.retries >= 0 ? runtime.retries : retryCount;
  const timeoutMs =
    Number.isFinite(runtime.timeoutMs) && runtime.timeoutMs > 0 ? runtime.timeoutMs : requestTimeoutMs;
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-openclaw-token": token,
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
      const elapsedMs = Date.now() - start;
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      clearTimeout(timer);
      return {
        ok: response.ok,
        status: response.status,
        elapsedMs,
        data,
        rawText: text,
        error: "",
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }
  return {
    ok: false,
    status: "N/A",
    elapsedMs: "N/A",
    data: null,
    rawText: "",
    error: lastError || "request_failed",
  };
}

function findProduct(payload) {
  const direct = payload?.products;
  const nested = payload?.data?.products;
  const products = Array.isArray(direct) ? direct : Array.isArray(nested) ? nested : [];
  return products[0] || null;
}

function formatStep(name, endpoint, status, elapsed, summary, error) {
  const safeSummary = summary || "-";
  const safeError = error || "-";
  console.log(`${name}: ${endpoint} / ${status} / ${elapsed} / ${safeSummary} / ${safeError}`);
}

async function main() {
  const hardTimer = setTimeout(() => {
    formatStep("step3", "/api/admin/optimize-products?productId=PID", "timeout", `${hardTimeoutMs}ms`, "polls=N/A", "script_hard_timeout");
    formatStep("step4", "/api/admin/products/PID", "N/A", "N/A", "titleLen=N/A,descLen=N/A,colorTags=N/A,sizeTags=N/A", "skipped");
    console.log("final: FAIL");
    process.exit(1);
  }, hardTimeoutMs);

  if (!baseUrl || !token) {
    formatStep("step1", "/api/admin/products?limit=1", "N/A", "N/A", "-", "missing OPENCLAW_ADMIN_BASE_URL or OPENCLAW_ADMIN_TOKEN");
    formatStep("step2", "/api/admin/optimize-products", "N/A", "N/A", "jobId=N/A,status=N/A", "skipped");
    formatStep("step3", "/api/admin/optimize-products?productId=PID", "timeout", "N/A", "polls=0", "skipped");
    formatStep("step4", "/api/admin/products/PID", "N/A", "N/A", "titleLen=N/A,descLen=N/A,colorTags=N/A,sizeTags=N/A", "skipped");
    console.log("final: FAIL");
    clearTimeout(hardTimer);
    process.exitCode = 1;
    return;
  }

  let pid = forceProductId;
  let step1Error = "";
  let step1Status = "N/A";
  let step1Elapsed = "N/A";
  let step1Summary = "-";

  if (pid) {
    step1Status = "SKIP";
    step1Elapsed = "N/A";
    step1Summary = `pid=${pid} (forced)`;
  } else {
    const step1 = await fetchWithRetry("/api/admin/products?limit=1");
    step1Status = String(step1.status);
    step1Elapsed = `${step1.elapsedMs}ms`;
    if (!step1.ok) {
      step1Error = pickError(step1.data) || step1.error || step1.rawText || "request_failed";
    } else {
      const product = findProduct(step1.data);
      if (!product || !product.id) {
        step1Error = "no product found";
      } else {
        pid = product.id;
        const titleLen = String(product.titleEn || "").length;
        const descLen = String(product.descriptionEn || "").length;
        step1Summary = `pid=${pid},titleLen=${titleLen},descLen=${descLen}`;
      }
    }
  }
  formatStep("step1", "/api/admin/products?limit=1", step1Status, step1Elapsed, step1Summary, step1Error);

  let step2JobId = "N/A";
  let step2StatusValue = "N/A";
  let step2Error = "";
  let step2HttpStatus = "N/A";
  let step2Elapsed = "N/A";

  if (pid) {
    const step2 = await fetchWithRetry("/api/admin/optimize-products", {
      method: "POST",
      body: JSON.stringify({ action: "queue", productId: pid }),
    });
    step2HttpStatus = String(step2.status);
    step2Elapsed = `${step2.elapsedMs}ms`;
    if (!step2.ok) {
      step2Error = pickError(step2.data) || step2.error || step2.rawText || "request_failed";
    } else {
      step2JobId = String(step2.data?.job?.id || step2.data?.data?.job?.id || "N/A");
      step2StatusValue = String(step2.data?.job?.status || step2.data?.data?.job?.status || "PENDING");
    }
  } else {
    step2Error = "skipped: missing pid";
  }
  formatStep(
    "step2",
    "/api/admin/optimize-products",
    step2HttpStatus,
    step2Elapsed,
    `jobId=${step2JobId},status=${step2StatusValue}`,
    step2Error,
  );

  let step3Final = "timeout";
  let step3Elapsed = "N/A";
  let step3Polls = 0;
  let step3Error = "";
  let lastStatusPayload = null;
  const pollStart = Date.now();

  if (pid && !step2Error) {
    const pollDeadline = pollStart + maxPollMs;
    while (Date.now() - pollStart < maxPollMs) {
      step3Polls += 1;
      const remainingMs = Math.max(3000, pollDeadline - Date.now());
      const poll = await fetchWithRetry(
        `/api/admin/optimize-products?productId=${encodeURIComponent(pid)}`,
        {},
        { retries: 0, timeoutMs: Math.min(requestTimeoutMs, remainingMs) },
      );
      if (!poll.ok) {
        step3Error = pickError(poll.data) || poll.error || poll.rawText || "poll_failed";
        console.log(
          `[poll] #${step3Polls} status=ERROR http=${poll.status} elapsed=${poll.elapsedMs}ms error=${step3Error}`,
        );
      } else {
        const statusRaw = poll.data?.status || poll.data?.data?.status;
        const errorRaw = poll.data?.error || poll.data?.data?.error || "";
        const normalized = normalizeStatus(statusRaw);
        lastStatusPayload = poll.data;
        console.log(`[poll] #${step3Polls} status=${normalized} http=${poll.status} elapsed=${poll.elapsedMs}ms`);
        if (normalized === "done" || normalized === "failed") {
          step3Final = normalized;
          step3Error = String(errorRaw || "");
          break;
        }
      }
      if (Date.now() >= pollDeadline) {
        break;
      }
      await sleep(pollIntervalMs);
    }
    if (step3Final !== "done" && step3Final !== "failed") {
      step3Final = "timeout";
      if (!step3Error && lastStatusPayload) {
        step3Error = `lastStatus=${normalizeStatus(lastStatusPayload?.status || lastStatusPayload?.data?.status)}`;
      }
    }
    step3Elapsed = `${Date.now() - pollStart}ms`;
  } else if (!pid) {
    step3Error = "skipped: missing pid";
  } else {
    step3Error = "skipped: queue failed";
  }
  formatStep(
    "step3",
    "/api/admin/optimize-products?productId=PID",
    step3Final,
    step3Elapsed,
    `polls=${step3Polls}`,
    step3Error,
  );

  let step4Status = "N/A";
  let step4Elapsed = "N/A";
  let step4Summary = "titleLen=N/A,descLen=N/A,colorTags=N/A,sizeTags=N/A";
  let step4Error = "";

  if (pid && step3Final === "done") {
    const step4 = await fetchWithRetry(`/api/admin/products/${encodeURIComponent(pid)}`);
    step4Status = String(step4.status);
    step4Elapsed = `${step4.elapsedMs}ms`;
    if (!step4.ok) {
      step4Error = pickError(step4.data) || step4.error || step4.rawText || "request_failed";
    } else {
      const product = step4.data?.product || step4.data?.data?.product || null;
      if (!product) {
        step4Error = "product payload missing";
      } else {
        const tags = Array.isArray(product.tags) ? product.tags : [];
        const colorTags = tags.filter((tag) => String(tag).toLowerCase().startsWith("color-")).length;
        const sizeTags = tags.filter((tag) => String(tag).toLowerCase().startsWith("size-")).length;
        const titleLen = String(product.titleEn || "").length;
        const descLen = String(product.descriptionEn || "").length;
        step4Summary = `titleLen=${titleLen},descLen=${descLen},colorTags=${colorTags},sizeTags=${sizeTags}`;
      }
    }
  } else if (step3Final !== "done") {
    step4Error = "skipped: step3 not done";
  } else {
    step4Error = "skipped: missing pid";
  }
  formatStep("step4", "/api/admin/products/PID", step4Status, step4Elapsed, step4Summary, step4Error);

  const pass = !step1Error && !step2Error && step3Final === "done" && !step4Error;
  console.log(`final: ${pass ? "PASS" : "FAIL"}`);
  clearTimeout(hardTimer);
  process.exitCode = pass ? 0 : 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  formatStep("step1", "/api/admin/products?limit=1", "N/A", "N/A", "-", message);
  formatStep("step2", "/api/admin/optimize-products", "N/A", "N/A", "jobId=N/A,status=N/A", "skipped");
  formatStep("step3", "/api/admin/optimize-products?productId=PID", "timeout", "N/A", "polls=0", "skipped");
  formatStep("step4", "/api/admin/products/PID", "N/A", "N/A", "titleLen=N/A,descLen=N/A,colorTags=N/A,sizeTags=N/A", "skipped");
  console.log("final: FAIL");
  process.exitCode = 1;
});
