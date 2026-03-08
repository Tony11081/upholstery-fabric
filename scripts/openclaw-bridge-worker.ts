import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { colorToTag, extractSizeOptionsFromText, normalizeColorValues, sizeToTag } from "../lib/utils/product-options";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();
const OPTIMIZATION_MODEL = process.env.OPENCLAW_OPTIMIZATION_MODEL || "claude-sonnet-4-5";

type PullResponse =
  | {
      ok: true;
      job: {
        id: string;
        type: "CHAT_COMPLETIONS" | "PRODUCT_OPTIMIZATION";
        lockId: string;
        attempts: number;
        request: unknown;
      };
    }
  | { ok: true; job: null };

type ChatCompletionsRequest = {
  model: string;
  messages: unknown;
  temperature?: number;
  max_tokens?: number;
};

type ProductOptimizationRequest = {
  productId: string;
  action: "optimize" | "analyze_colors";
};

type ProductImageRecord = { url: string; sortOrder?: number | null };
type ProductRecord = {
  id: string;
  titleEn: string;
  descriptionEn: string | null;
  tags: string[];
  images: ProductImageRecord[];
};

interface ColorVariant {
  name: string;
  color: string;
  description: string;
}

const TITLE_PLACEHOLDER_PATTERNS = [
  /^designer bag$/i,
  /^luxury item$/i,
  /^fashion item$/i,
  /^item$/i,
  /^new product$/i,
  /^test/i,
  /^luxury bag\s*#/i,
];

function isWeakTitle(title: string | null | undefined) {
  const normalized = (title ?? "").trim();
  if (!normalized) return true;
  if (normalized.length < 24) return true;
  return TITLE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isWeakDescription(description: string | null | undefined) {
  const normalized = (description ?? "").trim();
  return normalized.length < 120;
}

function buildOptionTags(existingTags: string[], colors: string[], title: string, description: string) {
  const preserved = existingTags.filter(
    (tag) => !tag.toLowerCase().startsWith("color-") && !tag.toLowerCase().startsWith("size-"),
  );
  const colorTags = normalizeColorValues(colors)
    .map((value) => colorToTag(value))
    .filter(Boolean);
  const sizes = extractSizeOptionsFromText([title, description].filter(Boolean).join(" "));
  const sizeTags = sizes.map((value) => sizeToTag(value)).filter(Boolean);
  return Array.from(new Set([...preserved, ...colorTags, ...sizeTags]));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractErrorMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") return value.message;
  if (typeof value === "string") return value;
  return null;
}

function resolveEnv(name: string) {
  const value = (process.env[name] ?? "").trim();
  return value.length ? value : null;
}

function resolveBridgeSiteUrl() {
  return (
    resolveEnv("OPENCLAW_BRIDGE_SITE_URL") ??
    resolveEnv("NEXT_PUBLIC_SITE_URL") ??
    resolveEnv("NEXTAUTH_URL")
  );
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function fetchJson<T>(input: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const message = extractErrorMessage(data) ?? response.statusText;
      throw new Error(`HTTP ${response.status}: ${message}`);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function pullJob(siteUrl: string, bridgeToken: string, workerId: string) {
  const url = `${siteUrl}/api/internal/openclaw-bridge/pull`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bridgeToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ workerId }),
  });

  if (response.status === 204) return null;
  const payload = (await response.json()) as PullResponse;
  if (!payload?.ok || !payload.job) return null;
  return payload.job;
}

async function completeJob(params: {
  siteUrl: string;
  bridgeToken: string;
  id: string;
  lockId: string;
  ok: boolean;
  response?: unknown;
  error?: string;
}) {
  const url = `${params.siteUrl}/api/internal/openclaw-bridge/complete`;
  await fetchJson(
    url,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.bridgeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: params.id,
        lockId: params.lockId,
        ok: params.ok,
        response: params.response,
        error: params.error,
      }),
    },
    15000,
  );
}

async function runChatCompletions(localBaseUrl: string, localToken: string, request: ChatCompletionsRequest) {
  const url = `${localBaseUrl}/chat/completions`;
  return fetchJson(
    url,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${localToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    120000,
  );
}

async function analyzeProductImages(imageUrls: string[], anthropic: Anthropic): Promise<ColorVariant[]> {
  if (imageUrls.length === 0) return [];

  const prompt = `Analyze this product image and identify all distinct color variants shown.

For each color variant, provide:
1. A concise color name (e.g., "Black", "Brown", "Blue Signature", "Tan/Pink")
2. The main color (single word: Black, Brown, Blue, Pink, etc.)
3. A brief description of the shade/material

Return ONLY a JSON array in this exact format:
[
  {
    "name": "Classic Monogram",
    "color": "Brown",
    "description": "Brown canvas with tan leather trim and gold hardware"
  }
]

If only one color is shown, return an array with one item.
If no clear product is visible, return an empty array: []`;

  try {
    const response = await anthropic.messages.create({
      model: OPTIMIZATION_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
            content: [
            ...imageUrls.slice(0, 4).map((url) => ({
              type: "image" as const,
              source: {
                type: "url" as const,
                url,
              },
            })),
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error("Error analyzing images:", error);
  }

  return [];
}

async function generateOptimizedContent(
  currentTitle: string,
  currentDescription: string | null,
  colors: ColorVariant[],
  anthropic: Anthropic,
  options?: { forceDetailed?: boolean },
): Promise<{ titleEn: string; descriptionEn: string }> {
  const colorInfo =
    colors.length > 0
      ? `Available in ${colors.length} color${colors.length > 1 ? "s" : ""}: ${colors.map((c) => c.name).join(", ")}`
      : "";

  const strictHint = options?.forceDetailed
    ? `\n\nIMPORTANT QUALITY RULES:\n- descriptionEn must be at least 140 words.\n- Do not return empty fields.\n- Keep title natural, not placeholder.`
    : "";

  const prompt = `You are an expert e-commerce copywriter for a luxury fashion marketplace.

Current product:
Title: ${currentTitle}
Description: ${currentDescription || "None"}
${colorInfo}

Generate optimized English content:

1. TITLE (50-80 characters):
   - Include brand, product type, and key feature
   - SEO-friendly but natural
   - Example: "Louis Vuitton Mini Speedy Bag 16cm - Monogram Canvas Crossbody"

2. DESCRIPTION (150-300 words):
   - Start with brand and product type
   - Highlight key features and materials
   - Include dimensions if mentioned
   - Mention color options if multiple
   - Professional, compelling tone
   - Focus on quality and authenticity
${strictHint}

Return ONLY a JSON object in this exact format:
{
  "titleEn": "Your optimized title here",
  "descriptionEn": "Your detailed description here"
}`;

  try {
    const response = await anthropic.messages.create({
      model: OPTIMIZATION_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error("Error generating content:", error);
  }

  return {
    titleEn: currentTitle,
    descriptionEn: currentDescription || "",
  };
}

async function fetchProductViaAdminApi(siteUrl: string, adminToken: string, productId: string): Promise<ProductRecord> {
  const data = await fetchJson<{ product?: any }>(
    `${siteUrl}/api/admin/products/${productId}`,
    {
      method: "GET",
      headers: {
        "x-openclaw-token": adminToken,
      },
    },
    15000,
  );

  const product = data?.product;
  if (!product || typeof product.id !== "string") {
    throw new Error(`Product not found via admin API: ${productId}`);
  }

  return {
    id: product.id,
    titleEn: String(product.titleEn ?? ""),
    descriptionEn: product.descriptionEn ? String(product.descriptionEn) : null,
    tags: Array.isArray(product.tags) ? product.tags.map((v: unknown) => String(v)) : [],
    images: Array.isArray(product.images)
      ? product.images.map((img: any) => ({
          url: String(img.url ?? ""),
          sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : null,
        }))
      : [],
  };
}

async function patchProductViaAdminApi(
  siteUrl: string,
  adminToken: string,
  productId: string,
  payload: { titleEn: string; descriptionEn: string; tags: string[] },
) {
  await fetchJson(
    `${siteUrl}/api/admin/products/${productId}`,
    {
      method: "PATCH",
      headers: {
        "x-openclaw-token": adminToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    15000,
  );
}

async function runProductOptimization(
  request: ProductOptimizationRequest,
  anthropic: Anthropic,
  options: { siteUrl: string; adminToken?: string | null },
) {
  console.log(`[product-optimization] Processing product ${request.productId}`);

  const product = options.adminToken
    ? await fetchProductViaAdminApi(options.siteUrl, options.adminToken, request.productId)
    : await prisma.product.findUnique({
        where: { id: request.productId },
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

  if (!product) {
    throw new Error(`Product not found: ${request.productId}`);
  }

  const imageUrls = product.images.map((img) => img.url).filter(Boolean);

  if (imageUrls.length === 0) {
    throw new Error("Product has no images");
  }

  // Analyze colors
  console.log(`[product-optimization] Analyzing ${imageUrls.length} images for colors...`);
  const colors = await analyzeProductImages(imageUrls, anthropic);
  console.log(`[product-optimization] Found ${colors.length} color variant(s)`);

  // Generate optimized content
  console.log(`[product-optimization] Generating optimized content...`);
  let optimized = await generateOptimizedContent(product.titleEn, product.descriptionEn, colors, anthropic);

  let nextTitle = optimized.titleEn.trim() || product.titleEn;
  let nextDescription = optimized.descriptionEn.trim() || product.descriptionEn || "";

  if (isWeakTitle(nextTitle) || isWeakDescription(nextDescription)) {
    console.log(`[product-optimization] weak output detected, retrying with stricter prompt...`);
    optimized = await generateOptimizedContent(product.titleEn, product.descriptionEn, colors, anthropic, {
      forceDetailed: true,
    });
    nextTitle = optimized.titleEn.trim() || product.titleEn;
    nextDescription = optimized.descriptionEn.trim() || product.descriptionEn || "";
  }

  // Update product
  const colorNames = colors.map((entry) => entry.name || entry.color || "").filter(Boolean);
  const updatedTags = buildOptionTags(product.tags || [], colorNames, nextTitle, nextDescription);

  const titleChanged = nextTitle.trim() !== (product.titleEn || "").trim();
  const descriptionChanged = nextDescription.trim() !== (product.descriptionEn || "").trim();
  const isQualityPass = !isWeakTitle(nextTitle) && !isWeakDescription(nextDescription);

  if (!isQualityPass) {
    throw new Error(
      `quality_gate_failed: weak_output title='${nextTitle.slice(0, 60)}' descLen=${nextDescription.trim().length}`,
    );
  }

  if (!titleChanged && !descriptionChanged) {
    console.log(`[product-optimization] no meaningful text change, skip update but mark success`);
    return {
      productId: request.productId,
      titleEn: product.titleEn,
      descriptionEn: product.descriptionEn || "",
      colors,
      tags: product.tags || [],
      skipped: "no_meaningful_change",
    };
  }

  if (options.adminToken) {
    await patchProductViaAdminApi(options.siteUrl, options.adminToken, request.productId, {
      titleEn: nextTitle,
      descriptionEn: nextDescription,
      tags: updatedTags,
    });
  } else {
    await prisma.product.update({
      where: { id: request.productId },
      data: {
        titleEn: nextTitle,
        descriptionEn: nextDescription,
        tags: updatedTags,
      },
      select: { id: true },
    });
  }

  console.log(`[product-optimization] ✓ Product updated successfully`);

  return {
    productId: request.productId,
    titleEn: nextTitle,
    descriptionEn: nextDescription,
    colors,
    tags: updatedTags,
  };
}

async function main() {
  const siteUrlRaw = resolveBridgeSiteUrl();
  const bridgeToken = resolveEnv("OPENCLAW_BRIDGE_TOKEN");
  const localBaseUrlRaw = resolveEnv("OPENCLAW_LOCAL_BASE_URL") ?? "http://127.0.0.1:18789/v1";
  const localToken = resolveEnv("OPENCLAW_LOCAL_TOKEN") ?? resolveEnv("OPENCLAW_GATEWAY_TOKEN");
  const adminToken = resolveEnv("OPENCLAW_ADMIN_TOKEN");
  const workerId = resolveEnv("OPENCLAW_BRIDGE_WORKER_ID") ?? `openclaw-bridge-${randomUUID().slice(0, 8)}`;

  if (!siteUrlRaw) {
    throw new Error("Missing OPENCLAW_BRIDGE_SITE_URL (or NEXT_PUBLIC_SITE_URL/NEXTAUTH_URL)");
  }
  if (!bridgeToken) {
    throw new Error("Missing OPENCLAW_BRIDGE_TOKEN");
  }
  if (!localToken) {
    throw new Error("Missing OPENCLAW_LOCAL_TOKEN (or OPENCLAW_GATEWAY_TOKEN)");
  }

  const siteUrl = normalizeBaseUrl(siteUrlRaw);
  const localBaseUrl = normalizeBaseUrl(localBaseUrlRaw);

  // Initialize Anthropic client for product optimization
  // Use remote API directly since we are running in Dokploy and can't reach local gateway
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "sk-41f9890b39782fc8a00c92a0ba8d8839ccc259f5d1db1d19b83dd113d2fd7f1f",
    baseURL: process.env.ANTHROPIC_BASE_URL || "https://v3.codesome.cn",
  });

  console.log(`[openclaw-bridge-worker] workerId=${workerId}`);
  console.log(`[openclaw-bridge-worker] siteUrl=${siteUrl}`);
  console.log(`[openclaw-bridge-worker] localBaseUrl=${localBaseUrl}`);
  console.log(`[openclaw-bridge-worker] productDataSource=${adminToken ? "admin-api" : "local-prisma"}`);
  console.log(`[openclaw-bridge-worker] Ready to process jobs...`);

  while (true) {
    let job: Awaited<ReturnType<typeof pullJob>> | null = null;
    try {
      job = await pullJob(siteUrl, bridgeToken, workerId);
    } catch (error) {
      console.error("[openclaw-bridge-worker] pull failed:", error);
      await sleep(3000);
      continue;
    }

    if (!job) {
      await sleep(800);
      continue;
    }

    try {
      if (job.type === "CHAT_COMPLETIONS") {
        const request = job.request as ChatCompletionsRequest;
        const response = await runChatCompletions(localBaseUrl, localToken, request);
        await completeJob({
          siteUrl,
          bridgeToken,
          id: job.id,
          lockId: job.lockId,
          ok: true,
          response,
        });
      } else if (job.type === "PRODUCT_OPTIMIZATION") {
        const request = job.request as ProductOptimizationRequest;
        const response = await runProductOptimization(request, anthropic, {
          siteUrl,
          adminToken,
        });
        await completeJob({
          siteUrl,
          bridgeToken,
          id: job.id,
          lockId: job.lockId,
          ok: true,
          response,
        });
      } else {
        throw new Error(`Unsupported job type: ${(job as any).type}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[openclaw-bridge-worker] job failed:", { id: job.id, message });
      try {
        await completeJob({
          siteUrl,
          bridgeToken,
          id: job.id,
          lockId: job.lockId,
          ok: false,
          error: message,
        });
      } catch (completeError) {
        console.error("[openclaw-bridge-worker] complete failed:", completeError);
      }
      await sleep(500);
    }
  }
}

main().catch((error) => {
  console.error("[openclaw-bridge-worker] fatal:", error);
  process.exitCode = 1;
});
