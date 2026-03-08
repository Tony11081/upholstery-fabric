import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type LoginResult = {
  ok: boolean;
  token?: string;
  source?: string;
  error?: string;
};

type InstallAttempt = {
  command: string;
  args: string[];
  shell: boolean;
  label: string;
};

type LocatorLike = {
  count: () => Promise<number>;
  nth: (index: number) => LocatorLike;
  first: () => LocatorLike;
  fill: (value: string) => Promise<unknown>;
  click: () => Promise<unknown>;
  isVisible: () => Promise<boolean>;
  isEditable?: () => Promise<boolean>;
  isDisabled?: () => Promise<boolean>;
  getAttribute?: (name: string) => Promise<string | null>;
};

type PageLike = {
  locator: (selector: string) => LocatorLike;
  waitForTimeout: (ms: number) => Promise<unknown>;
};

function resolveLoginConfig() {
  return {
    account: process.env.INFLYWAY_LOGIN_ACCOUNT?.trim() ?? "",
    password: process.env.INFLYWAY_LOGIN_PASSWORD?.trim() ?? "",
    loginUrl: process.env.INFLYWAY_LOGIN_URL?.trim() || "https://inflyway.com/kamelnet/#/login",
    headless: process.env.INFLYWAY_LOGIN_HEADLESS !== "false",
    channel: process.env.INFLYWAY_PLAYWRIGHT_CHANNEL?.trim() ?? "",
    executablePath: process.env.INFLYWAY_PLAYWRIGHT_EXECUTABLE_PATH?.trim() || undefined,
    timeoutMs: Number(process.env.INFLYWAY_LOGIN_TIMEOUT_MS ?? "45000"),
  };
}

async function captureFailureScreenshot(page: { screenshot: (opts: { path: string; fullPage: boolean }) => Promise<unknown> }) {
  try {
    const outputDir = path.join(process.cwd(), "output", "playwright");
    await fs.mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, `inflyway-login-failed-${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.warn("[inflyway][autologin] screenshot saved", { filePath });
    return filePath;
  } catch (error) {
    console.warn("[inflyway][autologin] screenshot failed", error);
    return undefined;
  }
}

function normalizeToken(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isLikelyInflywayToken(value: string) {
  return /^[a-f0-9]{24,128}$/i.test(value);
}

function extractTokenFromString(value: string): string {
  const normalized = normalizeToken(value);
  if (!normalized) return "";
  if (isLikelyInflywayToken(normalized)) return normalized;

  const directMatch = normalized.match(
    /"(?:token|access_token_id|accesstoken|authorization|accessToken)"\s*:\s*"([^"]+)"/i,
  );
  const directToken = normalizeToken(directMatch?.[1] ?? "");
  if (directToken && isLikelyInflywayToken(directToken)) return directToken;

  if (
    (normalized.startsWith("{") && normalized.endsWith("}")) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  ) {
    try {
      return findTokenInUnknown(JSON.parse(normalized));
    } catch {
      // ignore JSON parse failure
    }
  }

  return "";
}

function findTokenInUnknown(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    return extractTokenFromString(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTokenInUnknown(item);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";

  const obj = value as Record<string, unknown>;
  const keyCandidates = ["token", "access_token_id", "accesstoken", "authorization", "accessToken"];
  for (const key of keyCandidates) {
    const found = findTokenInUnknown(obj[key]);
    if (found) return found;
  }
  for (const nestedValue of Object.values(obj)) {
    const found = findTokenInUnknown(nestedValue);
    if (found) return found;
  }
  return "";
}

async function exists(filePath: string) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveConfiguredExecutablePath(configuredPath?: string) {
  const normalized = configuredPath?.trim();
  if (!normalized) return undefined;
  if (await exists(normalized)) return normalized;
  console.warn("[inflyway][autologin] configured executable missing, ignoring", {
    executablePath: normalized,
  });
  return undefined;
}

function parseNumericSuffix(value: string, prefix: string) {
  const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function resolvePlaywrightLocalBrowsersDir() {
  const envValue = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() ?? "";
  if (!envValue || envValue === "0") {
    return path.join(process.cwd(), "node_modules", "playwright-core", ".local-browsers");
  }
  // When set to a custom absolute path, Playwright uses that directory.
  // Avoid trying to interpret other special values.
  if (path.isAbsolute(envValue)) return envValue;
  return path.join(process.cwd(), envValue);
}

async function findInstalledExecutable(kind: "chromium" | "chromium_headless_shell") {
  const baseDir = resolvePlaywrightLocalBrowsersDir();
  const entries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
  const candidates: Array<{ dir: string; version: number }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (kind === "chromium") {
      const version = parseNumericSuffix(entry.name, "chromium-");
      if (version != null) candidates.push({ dir: entry.name, version });
    } else {
      const version = parseNumericSuffix(entry.name, "chromium_headless_shell-");
      if (version != null) candidates.push({ dir: entry.name, version });
    }
  }

  candidates.sort((a, b) => b.version - a.version);
  const subpaths =
    kind === "chromium"
      ? [
          path.join("chrome-linux64", "chrome"),
          path.join("chrome-linux", "chrome"),
        ]
      : [
          path.join("chrome-headless-shell-linux64", "chrome-headless-shell"),
          path.join("chrome-headless-shell-linux", "chrome-headless-shell"),
        ];

  for (const candidate of candidates) {
    for (const sub of subpaths) {
      const fullPath = path.join(baseDir, candidate.dir, sub);
      if (await exists(fullPath)) return fullPath;
    }
  }

  return undefined;
}

function isBrowserExecutableMissing(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  return (
    message.includes("Executable doesn't exist at") ||
    message.includes("Please run the following command to download new browsers") ||
    message.includes("Looks like Playwright Test or Playwright was just installed or updated")
  );
}

async function runInstallAttempt(attempt: InstallAttempt, env: NodeJS.ProcessEnv, timeoutMs: number) {
  return await new Promise<{ ok: boolean; code: number | null; output: string }>((resolve) => {
    const child = spawn(attempt.command, attempt.args, {
      env,
      shell: attempt.shell,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      output += `\n[spawn_error] ${attempt.label}: ${error instanceof Error ? error.message : String(error)}\n`;
      resolve({ ok: false, code: null, output });
    });

    const timer = setTimeout(() => {
      output += "\n[timeout] playwright install timed out\n";
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output });
    });
  });
}

async function ensurePlaywrightBrowsersInstalled(timeoutMs: number) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  env.PLAYWRIGHT_BROWSERS_PATH = "0";
  delete env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;

  const playwrightCli = path.join(process.cwd(), "node_modules", "playwright", "cli.js");
  const hasPlaywrightCli = await exists(playwrightCli);
  const attempts: InstallAttempt[] = [
    ...(hasPlaywrightCli
      ? [
          {
            command: "node",
            args: [playwrightCli, "install", "chromium", "--force"],
            shell: false,
            label: "node_playwright_cli_chromium",
          },
        ]
      : []),
    {
      command: "npx",
      args: ["playwright", "install", "chromium", "--force"],
      shell: true,
      label: "npx_chromium",
    },
    ...(hasPlaywrightCli
      ? [
          {
            command: "node",
            args: [playwrightCli, "install", "chromium-headless-shell", "--force"],
            shell: false,
            label: "node_playwright_cli_headless_shell",
          },
        ]
      : []),
    {
      command: "npx",
      args: ["playwright", "install", "chromium-headless-shell", "--force"],
      shell: true,
      label: "npx_headless_shell",
    },
  ];

  let lastOutput = "";
  for (const attempt of attempts) {
    const result = await runInstallAttempt(attempt, env, timeoutMs);
    lastOutput = result.output;
    if (!result.ok) {
      continue;
    }

    // Verify the binary exists. Playwright occasionally returns success while
    // downloads are skipped (e.g. env misconfiguration).
    if (attempt.args.includes("chromium-headless-shell")) {
      const installed = await findInstalledExecutable("chromium_headless_shell");
      if (installed) return { ok: true as const, output: result.output };
    } else {
      const installed = await findInstalledExecutable("chromium");
      if (installed) return { ok: true as const, output: result.output };
    }
  }

  return { ok: false as const, output: lastOutput };
}

async function clickFirstVisible(page: PageLike, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) continue;
      try {
        await candidate.click();
        return true;
      } catch {
        // Try the next candidate.
      }
    }
  }
  return false;
}

async function fillFirstEditable(page: PageLike, selectors: string[], value: string, label: string) {
  const looksLikeEmail = label === "account" && value.includes("@");
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) continue;
      let disabled = false;
      if (candidate.isDisabled) {
        disabled = await candidate.isDisabled().catch(() => false);
      }
      if (disabled) continue;
      let editable = true;
      if (candidate.isEditable) {
        editable = await candidate.isEditable().catch(() => true);
      }
      if (editable === false) continue;
      if (looksLikeEmail && candidate.getAttribute) {
        const [nameAttr, placeholderAttr, idAttr] = await Promise.all([
          candidate.getAttribute("name").catch(() => null),
          candidate.getAttribute("placeholder").catch(() => null),
          candidate.getAttribute("id").catch(() => null),
        ]);
        const fingerprint = [nameAttr, placeholderAttr, idAttr].filter(Boolean).join(" ").toLowerCase();
        if (
          fingerprint.includes("phone") ||
          fingerprint.includes("mobile") ||
          fingerprint.includes("tel") ||
          fingerprint.includes("手机")
        ) {
          continue;
        }
      }
      try {
        await candidate.fill(value);
        return selector;
      } catch {
        // Continue searching for a usable field.
      }
    }
  }

  throw new Error(`Unable to locate editable ${label} input`);
}

async function extractTokenFromPage(page: any) {
  return await page.evaluate(() => {
    const readCookie = (name: string) => {
      const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
      if (!match?.[1]) return "";
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    };
    const storageKeys = ["token", "access_token_id", "accesstoken", "authorization", "accessToken"];
    const fromStorage = (storage: Storage | null) => {
      if (!storage) return "";
      for (const key of storageKeys) {
        const value = storage.getItem(key);
        if (value) return value;
      }
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key) continue;
        const value = storage.getItem(key);
        if (!value) continue;
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("token") || lowerKey.includes("auth")) return value;
      }
      return "";
    };
    const errorText =
      (document.querySelector(".el-message, .el-form-item__error, .ant-message") as HTMLElement | null)
        ?.innerText?.trim() || "";
    const bodyText = document.body?.innerText?.slice(0, 1000) || "";

    const token =
      fromStorage(window.localStorage) ||
      fromStorage(window.sessionStorage) ||
      readCookie("token") ||
      readCookie("access_token_id") ||
      readCookie("accesstoken");
    return {
      token,
      source: token ? "playwright_page" : "",
      href: window.location.href,
      errorText,
      bodyText,
    };
  });
}

async function extractTokenFromContextCookies(context: any) {
  const cookies = await context.cookies().catch(() => []);
  const tokenCookieNames = ["token", "access_token_id", "accesstoken", "authorization"];
  for (const name of tokenCookieNames) {
    const cookie = cookies.find((item: any) => item?.name === name && item?.value);
    const token = extractTokenFromString(String(cookie?.value ?? ""));
    if (token) {
      return { token, source: `cookie:${name}` };
    }
  }
  return { token: "", source: "" };
}

export async function refreshInflywayTokenWithPlaywright(): Promise<LoginResult> {
  const config = resolveLoginConfig();
  if (!config.account || !config.password) {
    return {
      ok: false,
      error: "Missing INFLYWAY_LOGIN_ACCOUNT or INFLYWAY_LOGIN_PASSWORD",
    };
  }

  try {
    // Ensure the browser path is stable across users/containers. If the host
    // doesn't set it, default to Playwright's "local" mode inside node_modules.
    if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
    }
    delete process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
    const playwright = await import("playwright");
    const configuredExecutablePath = await resolveConfiguredExecutablePath(config.executablePath);
    const browserLaunchOptions: Record<string, unknown> = {
      headless: config.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };
    if (configuredExecutablePath) {
      browserLaunchOptions.executablePath = configuredExecutablePath;
    } else {
      // By default Playwright uses "chromium-headless-shell" in headless mode,
      // which is frequently missing in slim Docker images. Force "chromium"
      // unless explicitly overridden.
      const configuredChannel = config.channel.trim();
      const normalizedChannel = configuredChannel.toLowerCase();
      const channel =
        configuredChannel && normalizedChannel !== "auto" && normalizedChannel !== "default"
          ? configuredChannel
          : "chromium";
      browserLaunchOptions.channel = channel;
    }

    const chromiumFallbackPath = playwright.chromium.executablePath?.();
    const canFallbackToChromium = Boolean(
      chromiumFallbackPath && typeof chromiumFallbackPath === "string"
    );

    const launch = async (launchOptions: Record<string, unknown>) => {
      return await playwright.chromium.launch(launchOptions as any);
    };

    const withExecutablePath = (executablePath: string) => {
      const merged: Record<string, unknown> = { ...browserLaunchOptions, executablePath };
      // When executablePath is specified, do not also pass channel. Some
      // Playwright versions treat the combination as conflicting.
      delete merged.channel;
      return merged;
    };

    let browser: any;
    try {
      browser = await launch(browserLaunchOptions);
    } catch (error) {
      if (!isBrowserExecutableMissing(error)) {
        throw error;
      }

      const tryLaunchWithKnownExecutable = async () => {
        const installedChromium = await findInstalledExecutable("chromium");
        if (installedChromium) {
          try {
            return await launch(withExecutablePath(installedChromium));
          } catch {
            // Continue to next fallback.
          }
        }
        if (canFallbackToChromium) {
          const fallbackPath = chromiumFallbackPath as string;
          if (await exists(fallbackPath)) {
            try {
              return await launch(withExecutablePath(fallbackPath));
            } catch {
              // Continue to install attempt below.
            }
          }
        }
        const installedHeadlessShell = await findInstalledExecutable("chromium_headless_shell");
        if (installedHeadlessShell) {
          try {
            return await launch(withExecutablePath(installedHeadlessShell));
          } catch {
            // Continue to install attempt below.
          }
        }
        return null;
      };

      browser = await tryLaunchWithKnownExecutable();

      if (!browser) {
        console.warn("[inflyway][autologin] playwright browser missing; attempting install");
        const installResult = await ensurePlaywrightBrowsersInstalled(
          Math.max(300_000, config.timeoutMs),
        );
        if (!installResult.ok) {
          console.warn(
            "[inflyway][autologin] playwright install failed",
            installResult.output?.slice(0, 2000),
          );
          throw error;
        }

        try {
          browser = await launch(browserLaunchOptions);
        } catch (error2) {
          browser = await tryLaunchWithKnownExecutable();
          if (!browser) {
            throw error2;
          }
        }
      }
    }
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.setDefaultTimeout(config.timeoutMs);
    let observedToken = "";
    let observedTokenSource = "";
    page.on("response", async (response: any) => {
      if (observedToken) return;
      const url = String(response?.url?.() ?? "");
      if (!url.includes("inflyway.com")) return;
      try {
        const contentType = String(response.headers?.()["content-type"] ?? "");
        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null);
          const token = findTokenInUnknown(payload);
          if (token) {
            observedToken = token;
            observedTokenSource = `response:${url}`;
          }
          return;
        }
        const text = await response.text().catch(() => "");
        if (!text) return;
        const directMatch = text.match(
          /"(?:token|access_token_id|accesstoken|authorization|accessToken)"\s*:\s*"([^"]+)"/i,
        );
        const token = extractTokenFromString(directMatch?.[1] ?? "");
        if (token) {
          observedToken = token;
          observedTokenSource = `response:${url}`;
        }
      } catch {
        // Ignore response parsing errors; token may still be available elsewhere.
      }
    });

    try {
      await page.goto(config.loginUrl, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
      const accountLooksLikeEmail = config.account.includes("@");

      await clickFirstVisible(page as any, [
        "text=账号密码登录",
        "text=密码登录",
        ".el-tabs__item:has-text('密码')",
        ".ant-tabs-tab:has-text('密码')",
      ]).catch(() => false);
      if (accountLooksLikeEmail) {
        await clickFirstVisible(page as any, [
          "text=邮箱登录",
          "text=邮箱账号登录",
          "text=邮箱",
          "text=Email",
          ".el-tabs__item:has-text('邮箱')",
          ".ant-tabs-tab:has-text('邮箱')",
        ]).catch(() => false);
      } else {
        await clickFirstVisible(page as any, [
          "text=手机号登录",
          "text=手机登录",
          "text=手机号",
          ".el-tabs__item:has-text('手机')",
          ".ant-tabs-tab:has-text('手机')",
        ]).catch(() => false);
      }
      await page.waitForTimeout(300);

      const editableInputSuffix = ':not([readonly]):not([disabled])';
      const accountSelectors = [
        `input[name="account"]${editableInputSuffix}`,
        `input[name="username"]${editableInputSuffix}`,
        `input[name="email"]${editableInputSuffix}`,
        `input[name="mail"]${editableInputSuffix}`,
        `input[type="email"]${editableInputSuffix}`,
        `input[autocomplete="username"]${editableInputSuffix}`,
        `input[placeholder*="邮箱"]${editableInputSuffix}`,
        `input[placeholder*="账号"]${editableInputSuffix}`,
        `input[placeholder*="Email"]${editableInputSuffix}`,
        `input[placeholder*="email"]${editableInputSuffix}`,
        ...(!accountLooksLikeEmail
          ? [
              `input[name="mobile"]${editableInputSuffix}`,
              `input[name="phone"]${editableInputSuffix}`,
              `input[type="tel"]${editableInputSuffix}`,
              `input[placeholder*="手机"]${editableInputSuffix}`,
              `input[placeholder*="电话"]${editableInputSuffix}`,
              `input[placeholder*="Phone"]${editableInputSuffix}`,
              `input[placeholder*="phone"]${editableInputSuffix}`,
            ]
          : []),
        `input[type="text"]${editableInputSuffix}`,
      ];
      const passwordSelectors = [
        `input[name="password"]${editableInputSuffix}`,
        `input[type="password"]${editableInputSuffix}`,
        `input[autocomplete="current-password"]${editableInputSuffix}`,
        `input[placeholder*="密码"]${editableInputSuffix}`,
        `input[placeholder*="Password"]${editableInputSuffix}`,
      ];

      await fillFirstEditable(page as any, accountSelectors, config.account, "account");
      await fillFirstEditable(page as any, passwordSelectors, config.password, "password");

      const buttonCandidates = [
        "button:has-text('登录')",
        "button:has-text('登 录')",
        "button:has-text('Sign in')",
        "button:has-text('Login')",
        ".ant-btn-primary",
      ];
      let clicked = false;
      for (const selector of buttonCandidates) {
        const button = page.locator(selector).first();
        if ((await button.count()) > 0) {
          await button.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        throw new Error("Unable to locate login submit button");
      }

      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle", { timeout: config.timeoutMs }).catch(() => null);

      let tokenPayload = await extractTokenFromPage(page);
      let token = extractTokenFromString(String(tokenPayload?.token ?? ""));
      let tokenSource = tokenPayload?.source || "";

      for (let attempt = 0; !token && attempt < 6; attempt += 1) {
        const cookieToken = await extractTokenFromContextCookies(context);
        token = extractTokenFromString(cookieToken.token);
        if (token) {
          tokenSource = cookieToken.source || "playwright_cookie";
          break;
        }

        if (observedToken) {
          token = extractTokenFromString(observedToken);
          tokenSource = observedTokenSource || "playwright_response";
          break;
        }

        await page.waitForTimeout(500);
        tokenPayload = await extractTokenFromPage(page);
        token = extractTokenFromString(String(tokenPayload?.token ?? ""));
        if (token) {
          tokenSource = tokenPayload?.source || "playwright_page";
          break;
        }
      }

      if (!token) {
        const screenshotPath = await captureFailureScreenshot(page);
        const uiMessage = normalizeToken(tokenPayload?.errorText) || "";
        return {
          ok: false,
          error:
            `Login submitted but token not found (url=${tokenPayload?.href ?? "unknown"}` +
            `${uiMessage ? `, ui=${uiMessage}` : ""}` +
            `${screenshotPath ? `, screenshot=${screenshotPath}` : ""})`,
        };
      }

      return {
        ok: true,
        token,
        source: tokenSource || "playwright_login",
      };
    } finally {
      await context.close();
      await browser.close();
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Playwright login failed",
    };
  }
}
