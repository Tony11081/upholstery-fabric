import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { acquireAiSlot } from "@/lib/ai/ai-limiter";
import { isAiChatConfigured, openRouterChat, type OpenRouterContentPart } from "@/lib/ai/openrouter";
import { signPreviewRows, verifyPreviewToken } from "@/lib/ai/preview-signature";
import { createApiContext, jsonError, jsonOk, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { parseCsv, parseBoolean, splitList, type CsvRow } from "@/lib/utils/csv";
import { slugify } from "@/lib/utils/slug";
import { scoreProductQuality, type QualityImage } from "@/lib/utils/quality";
import { buildProductMerchandising } from "@/lib/utils/product-merchandising";
import { ensureCategoryPath } from "@/lib/utils/import-classifier";

type ImportError = {
  row: number;
  message: string;
  title?: string;
  slug?: string;
};

type CategoryOption = {
  slug: string;
  nameEn: string;
};

type AiNormalized = {
  titleEn: string;
  descriptionEn?: string;
  categorySlug?: string;
  categoryName?: string;
  tags: string[];
};

type PreviewRow = {
  row: number;
  titleEn: string;
  descriptionEn?: string | null;
  slug: string;
  categorySlug?: string;
  categoryName?: string;
  tags: string[];
  imageUrls: string[];
  price: number | null;
  currency: string;
  inventory: number;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  qualityScore?: number;
  qualityNotes?: string[];
  error?: string;
  warnings?: string[];
};

type AiEstimate = {
  totalTokens: number;
  totalCostUsd: number;
  perRowTokens: number;
  perRowCostUsd: number;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return match[0];
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag ?? "").trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return splitList(value).map((tag) => tag.toLowerCase());
  }
  return [];
}

function buildAiPrompt(row: CsvRow, categories: CategoryOption[], imageUrl?: string) {
  const rawTitle =
    row.title_en || row.title || row.name || row.title_cn || row.name_cn || row.title_zh || row.name_zh || "";
  const rawDescription =
    row.description_en || row.description || row.desc || row.description_cn || row.description_zh || "";
  const rawCategory = row.category_slug || row.category_name || row.category || "";
  const rawTags = row.tags || row.keywords || row.tag || "";
  const categoryList = categories.length
    ? categories.map((category) => `${category.nameEn} (${category.slug})`).join(", ")
    : "none";

  const prompt = [
    "Transform the product into the required ecommerce fields.",
    "Use American English. Translate Chinese if needed.",
    "If the title is missing or not in English, create a short luxury title based on the image.",
    "Choose a category from the existing list when possible; otherwise propose a new one.",
    "category_slug must be lowercase kebab-case.",
    "tags should be 3-6 short lowercase keywords.",
    "Return JSON only with keys: title_en, description_en, category_slug, category_name, tags.",
    "",
    `Title: ${rawTitle || "(none)"}`,
    `Description: ${rawDescription || "(none)"}`,
    `Category hint: ${rawCategory || "(none)"}`,
    `Tags hint: ${rawTags || "(none)"}`,
    `Existing categories: ${categoryList}`,
  ].join("\n");

  const content: OpenRouterContentPart[] = [{ type: "text", text: prompt }];
  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  return { prompt, content, rawCategory, rawTags };
}

function estimateAiCost(rows: CsvRow[], categories: CategoryOption[]): AiEstimate {
  const outputTokens = Number(process.env.AI_EST_OUTPUT_TOKENS ?? 600);
  const costPer1k = Number(process.env.AI_COST_PER_1K_TOKENS_USD ?? 0.01);
  const imageTokenBonus = Number(process.env.AI_IMAGE_TOKEN_BONUS ?? 0);

  let totalTokens = 0;
  rows.forEach((row) => {
    const imageUrl = splitList(row.image_urls || row.images || row.image_url || row.image || "")[0];
    const { prompt } = buildAiPrompt(row, categories, imageUrl);
    const inputTokens = estimateTokens(prompt) + (imageUrl ? imageTokenBonus : 0);
    totalTokens += inputTokens + outputTokens;
  });

  const perRowTokens = rows.length ? Math.ceil(totalTokens / rows.length) : 0;
  const totalCostUsd = Number(((totalTokens / 1000) * costPer1k).toFixed(4));
  const perRowCostUsd = rows.length ? Number((totalCostUsd / rows.length).toFixed(4)) : 0;
  return { totalTokens, totalCostUsd, perRowTokens, perRowCostUsd };
}

async function normalizeRowWithAi(row: CsvRow, categories: CategoryOption[], imageUrl?: string) {
  const { prompt, content, rawCategory, rawTags } = buildAiPrompt(row, categories, imageUrl);
  const release = await acquireAiSlot();
  try {
    const responseText = await openRouterChat({
      messages: [
        {
          role: "system",
          content: "You are a luxury ecommerce merchandiser. Respond with JSON only.",
        },
        {
          role: "user",
          content: imageUrl ? content : prompt,
        },
      ],
    });

    const jsonPayload = extractJson(responseText);
    if (!jsonPayload) {
      throw new Error("AI response did not include JSON");
    }

    const parsed = JSON.parse(jsonPayload) as Record<string, unknown>;
    const titleEn = String(parsed.title_en ?? "").trim();
    if (!titleEn) {
      throw new Error("AI response missing title_en");
    }

    const descriptionEn = String(parsed.description_en ?? "").trim();
    const categorySlug = slugify(String(parsed.category_slug ?? parsed.category ?? rawCategory ?? ""));
    const categoryName = String(parsed.category_name ?? "").trim();
    const tags = normalizeTags(parsed.tags ?? rawTags).slice(0, 8);

    const normalized: AiNormalized = {
      titleEn,
      descriptionEn: descriptionEn || undefined,
      categorySlug: categorySlug || undefined,
      categoryName: categoryName || undefined,
      tags,
    };

    return normalized;
  } finally {
    release();
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function validateImageUrl(url: string, timeoutMs: number) {
  if (!isHttpUrl(url)) {
    return { url, ok: false, reason: "Invalid URL" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (!res.ok || !res.headers.get("content-type")) {
      res = await fetch(url, { method: "GET", signal: controller.signal });
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      return { url, ok: false, reason: `HTTP ${res.status}` };
    }
    if (!contentType.startsWith("image/")) {
      return { url, ok: false, reason: "Not an image" };
    }
    return { url, ok: true, reason: "" };
  } catch (error) {
    return { url, ok: false, reason: error instanceof Error ? error.message : "Fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function validateImageUrls(urls: string[]) {
  const timeoutMs = Number(process.env.AI_IMAGE_VALIDATE_TIMEOUT_MS ?? 6000);
  const results = [];
  for (const url of urls) {
    results.push(await validateImageUrl(url, timeoutMs));
  }
  const validUrls = results.filter((item) => item.ok).map((item) => item.url);
  const invalid = results.filter((item) => !item.ok).map((item) => ({ url: item.url, reason: item.reason }));
  return { validUrls, invalid };
}

function getRetryAfterMs(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs;
  if (typeof retryAfterMs === "number") {
    return retryAfterMs;
  }
  return null;
}

function parseXlsx(buffer: ArrayBuffer): CsvRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as Array<
    Array<string | number | boolean>
  >;
  if (!rows.length) return [];
  const headers = rows[0].map((cell) => normalizeHeader(String(cell ?? "")));
  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => String(cell ?? "").trim() !== ""))
    .map((cells) => {
      const record: CsvRow = {};
      headers.forEach((header, idx) => {
        record[header] = String(cells[idx] ?? "").trim();
      });
      return record;
    });
}

async function parseImportFile(file: File): Promise<CsvRow[]> {
  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
  if (isXlsx) {
    const buffer = await file.arrayBuffer();
    return parseXlsx(buffer);
  }
  const text = await file.text();
  return parseCsv(text);
}

function previewRowsToCsvRows(previewRows: PreviewRow[]): CsvRow[] {
  return previewRows.map((row) => ({
    __row: String(row.row),
    title_en: row.titleEn,
    description_en: row.descriptionEn ?? "",
    slug: row.slug,
    category_slug: row.categorySlug ?? "",
    category_name: row.categoryName ?? "",
    tags: row.tags?.join("|") ?? "",
    image_urls: row.imageUrls?.join("|") ?? "",
    price: row.price !== null ? String(row.price) : "",
    currency: row.currency ?? "USD",
    inventory: String(row.inventory ?? 0),
    is_new: row.isNew ? "true" : "false",
    is_best_seller: row.isBestSeller ? "true" : "false",
    is_active: row.isActive ? "true" : "false",
  }));
}

async function ensureUniqueSlug(baseSlug: string) {
  let unique = baseSlug;
  let counter = 1;
  while (await prisma.product.findUnique({ where: { slug: unique } })) {
    unique = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return unique;
}

async function resolveCategory(
  slug: string,
  name: string | undefined,
  shouldCreate: boolean,
  status: "ACTIVE" | "PENDING",
) {
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return { id: existing.id, slug: existing.slug, nameEn: existing.nameEn, missing: false };
  }
  if (!shouldCreate) {
    return { id: null, slug, nameEn: name ?? slug, missing: true };
  }
  const created = await prisma.category.create({ data: { slug, nameEn: name ?? slug, status } });
  return { id: created.id, slug: created.slug, nameEn: created.nameEn, missing: false };
}

function errorsToCsv(errors: ImportError[]) {
  const header = "row,title,slug,error";
  const lines = errors.map((error) =>
    [
      error.row,
      error.title ?? "",
      error.slug ?? "",
      `"${(error.message ?? "").replace(/"/g, "\"\"")}"`,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const url = new URL(request.url);
  const aiMode = url.searchParams.get("mode") === "ai" || url.searchParams.get("ai") === "1";
  const previewMode = url.searchParams.get("preview") === "1" || url.searchParams.get("preview") === "true";
  const usePreviewResults =
    url.searchParams.get("usePreview") === "1" || url.searchParams.get("usePreview") === "true";
  const aiEnabled = process.env.AI_IMPORT_ENABLED !== "false";
  if (aiMode && !aiEnabled) {
    logApiWarning(ctx, 400, { reason: "ai_disabled" });
    return jsonError("AI import is disabled", 400, ctx, { code: "AI_DISABLED" });
  }

  if (previewMode && usePreviewResults) {
    logApiWarning(ctx, 400, { reason: "preview_usepreview_conflict" });
    return jsonError("Preview mode cannot use preview results", 400, ctx, { code: "INVALID_MODE" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let rows: CsvRow[] = [];
  let previewPayload: PreviewRow[] | null = null;
  let previewToken: string | null = null;

  if (usePreviewResults) {
    if (contentType.includes("application/json")) {
        let body: { previewRows?: PreviewRow[]; previewToken?: string } | null = null;
      try {
        body = (await request.json()) as { previewRows?: PreviewRow[]; previewToken?: string };
      } catch {
        logApiWarning(ctx, 400, { reason: "invalid_json" });
        return jsonError("Invalid JSON body", 400, ctx, { code: "INVALID_BODY" });
      }
      previewPayload = Array.isArray(body?.previewRows) ? body?.previewRows ?? [] : [];
      previewToken = body?.previewToken ?? null;
    } else {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        logApiWarning(ctx, 400, { reason: "invalid_form" });
        return jsonError("Invalid form data", 400, ctx, { code: "INVALID_BODY" });
      }
      const previewField = form.get("previewRows") ?? form.get("preview");
      try {
        if (typeof previewField === "string") {
          previewPayload = JSON.parse(previewField) as PreviewRow[];
        } else if (previewField instanceof File) {
          const text = await previewField.text();
          previewPayload = JSON.parse(text) as PreviewRow[];
        }
      } catch {
        logApiWarning(ctx, 400, { reason: "invalid_preview_json" });
        return jsonError("Invalid preview payload", 400, ctx, { code: "INVALID_PREVIEW" });
      }
      const tokenField = form.get("previewToken");
      if (typeof tokenField === "string") {
        previewToken = tokenField;
      }
    }

    if (!previewPayload || previewPayload.length === 0) {
      logApiWarning(ctx, 400, { reason: "missing_preview_payload" });
      return jsonError("Preview results are required", 400, ctx, { code: "PREVIEW_REQUIRED" });
    }

    if (!previewToken) {
      logApiWarning(ctx, 400, { reason: "missing_preview_token" });
      return jsonError("Preview token is required", 400, ctx, { code: "PREVIEW_TOKEN_REQUIRED" });
    }

    try {
      const validation = verifyPreviewToken(previewPayload, previewToken);
      if (!validation.ok) {
        logApiWarning(ctx, 400, { reason: "preview_token_invalid", detail: validation.reason });
        return jsonError(validation.reason ?? "Invalid preview token", 400, ctx, {
          code: "PREVIEW_TOKEN_INVALID",
        });
      }
    } catch (error) {
      logApiWarning(ctx, 400, { reason: "preview_token_error" });
      return jsonError(error instanceof Error ? error.message : "Preview token error", 400, ctx, {
        code: "PREVIEW_TOKEN_ERROR",
      });
    }

    if (previewPayload.some((row) => row.error)) {
      logApiWarning(ctx, 400, { reason: "preview_has_errors" });
      return jsonError("Preview contains errors. Fix them before importing.", 400, ctx, {
        code: "PREVIEW_HAS_ERRORS",
      });
    }

    rows = previewRowsToCsvRows(previewPayload);
  } else {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      logApiWarning(ctx, 400, { reason: "invalid_form" });
      return jsonError("Invalid form data", 400, ctx, { code: "INVALID_BODY" });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      logApiWarning(ctx, 400, { reason: "missing_file" });
      return jsonError("CSV/XLSX file is required", 400, ctx, { code: "VALIDATION_FAILED" });
    }

    rows = await parseImportFile(file);
    if (!rows.length) {
      logApiWarning(ctx, 400, { reason: "empty_file" });
      return jsonError("Import file is empty", 400, ctx, { code: "VALIDATION_FAILED" });
    }
  }

  if (aiMode && !usePreviewResults && !isAiChatConfigured()) {
    logApiWarning(ctx, 400, { reason: "missing_ai_config" });
    return jsonError("AI provider is not configured for AI import", 400, ctx, {
      code: "AI_CONFIG_MISSING",
    });
  }

  const aiMaxRows = Number(process.env.AI_IMPORT_MAX_ROWS ?? 25);
  if (aiMode && rows.length > aiMaxRows) {
    logApiWarning(ctx, 400, { reason: "ai_row_limit", count: rows.length });
    return jsonError(`AI import supports up to ${aiMaxRows} rows per upload`, 400, ctx, {
      code: "AI_ROW_LIMIT",
    });
  }

  const aiModeEffective = aiMode && !usePreviewResults;
  const categoryOptions: CategoryOption[] = aiModeEffective
    ? await prisma.category.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, nameEn: true },
      })
    : [];
  const aiEstimate = aiModeEffective ? estimateAiCost(rows, categoryOptions) : null;
  const imageValidationEnabled = process.env.IMPORT_VALIDATE_IMAGES !== "false" && !usePreviewResults;
  const categoryCreateStatus: "ACTIVE" | "PENDING" = aiMode ? "PENDING" : "ACTIVE";

  let created = 0;
  const errors: ImportError[] = [];
  const previewRows: PreviewRow[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    let normalizedRow: CsvRow = { ...row };
    const rowNumber = Number(normalizedRow.__row ?? index + 2);
    const warnings: string[] = [];

    const rawImageUrls = splitList(
      normalizedRow.image_urls || normalizedRow.images || normalizedRow.image_url || normalizedRow.image,
    );
    let imageUrls = rawImageUrls;
    let invalidImageDetails = "";
    if (imageValidationEnabled && rawImageUrls.length > 0) {
      const validation = await validateImageUrls(rawImageUrls);
      imageUrls = validation.validUrls;
      if (validation.invalid.length) {
        invalidImageDetails = validation.invalid
          .map((item) => `${item.url} (${item.reason})`)
          .join("; ");
        warnings.push(`Invalid image URLs removed: ${invalidImageDetails}`);
      }
    }
    if (imageUrls.length) {
      normalizedRow.image_urls = imageUrls.join("|");
    }

    if (aiModeEffective) {
      try {
        const aiNormalized = await normalizeRowWithAi(normalizedRow, categoryOptions, imageUrls[0]);
        normalizedRow = {
          ...normalizedRow,
          title_en: aiNormalized.titleEn,
          description_en: aiNormalized.descriptionEn ?? normalizedRow.description_en,
          category_slug: aiNormalized.categorySlug ?? normalizedRow.category_slug,
          category_name: aiNormalized.categoryName ?? normalizedRow.category_name,
          tags: aiNormalized.tags.length ? aiNormalized.tags.join("|") : normalizedRow.tags,
        };
      } catch (error) {
        const retryAfterMs = getRetryAfterMs(error);
        if (retryAfterMs) {
          const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
          logApiWarning(ctx, 429, { reason: "ai_rate_limited", retryAfterSeconds });
          return jsonError(`AI rate limit exceeded. Try again in ${retryAfterSeconds}s.`, 429, ctx, {
            code: "AI_RATE_LIMITED",
            retryAfterSeconds,
          });
        }
        errors.push({
          row: rowNumber,
          title: normalizedRow.title_en || normalizedRow.title || normalizedRow.name,
          slug: normalizedRow.slug,
          message: error instanceof Error ? error.message : "AI normalization failed.",
        });
        continue;
      }
    }

    const rawTitle = normalizedRow.title_en || normalizedRow.title || normalizedRow.name || "";
    const slugInput = normalizedRow.slug;
    const priceValue = normalizedRow.price ?? normalizedRow.price_usd ?? normalizedRow.amount;
    const currency = normalizedRow.currency || "USD";
    const rawDescription = normalizedRow.description_en || normalizedRow.description || null;
    const inventoryValue = normalizedRow.inventory ?? normalizedRow.stock ?? "0";
    const merchandising = buildProductMerchandising({
      title: rawTitle,
      description: rawDescription,
      tags: splitList(normalizedRow.tags),
      colors: [normalizedRow.colors, normalizedRow.color_options, normalizedRow.variants],
      sizes: [normalizedRow.sizes, normalizedRow.size_options, normalizedRow.variants],
      materials: [normalizedRow.materials, normalizedRow.fabric, normalizedRow.variants],
      variants: normalizedRow.variants,
      aiCategory: normalizedRow.category_slug || normalizedRow.category_name || normalizedRow.category,
      preferExistingTitle: false,
      preferExistingDescription: false,
      currentCategorySlug: normalizedRow.category_slug || null,
    });
    const title = merchandising.titleEn;
    const description = merchandising.descriptionEn || null;
    const tags = merchandising.tags;

    let errorMessage: string | undefined;
    if (rawImageUrls.length > 0 && imageUrls.length === 0) {
      errorMessage = invalidImageDetails
        ? `No valid image URLs. ${invalidImageDetails}`
        : "No valid image URLs.";
    }
    if (!errorMessage && (!title || !priceValue)) {
      errorMessage = "Missing required fields (title, price).";
    }

    const parsedPrice = Number(priceValue);
    if (!errorMessage && !Number.isFinite(parsedPrice)) {
      errorMessage = "Invalid price.";
    }

    const baseSlug = slugify(slugInput ?? title);
    if (!errorMessage && !baseSlug) {
      errorMessage = "Invalid slug.";
    }

    let categoryId: string | null = null;
    let resolvedCategory: { slug: string; nameEn: string; missing: boolean } | null = null;
    if (merchandising.classification.categorySlug) {
      const normalizedSlug = slugify(merchandising.classification.categorySlug);
      if (normalizedSlug) {
        const category = await resolveCategory(
          normalizedSlug,
          merchandising.classification.categoryLabel,
          !previewMode,
          categoryCreateStatus,
        );
        resolvedCategory = { slug: category.slug, nameEn: category.nameEn, missing: category.missing };
        if (!previewMode) {
          const categoryPath = await ensureCategoryPath(prisma, merchandising.classification);
          categoryId = categoryPath.categoryId;
          resolvedCategory = {
            slug: categoryPath.categorySlug,
            nameEn: categoryPath.categoryLabel,
            missing: false,
          };
        } else if (category.missing) {
          warnings.push(
            categoryCreateStatus === "PENDING" ? "Category pending approval" : "Category will be created",
          );
        }
      }
    }

    const slug = baseSlug ? await ensureUniqueSlug(baseSlug) : "";
    const qualityImages: QualityImage[] = imageUrls.map((url, imgIndex) => ({
      url,
      alt: title,
      isCover: imgIndex === 0,
    }));
    const quality = scoreProductQuality({
      title,
      description: description ?? "",
      images: qualityImages,
    });
    const previewRow: PreviewRow = {
      row: rowNumber,
      titleEn: title,
      descriptionEn: description,
      slug,
      categorySlug: resolvedCategory?.slug,
      categoryName: resolvedCategory?.nameEn,
      tags,
      imageUrls,
      price: Number.isFinite(parsedPrice) ? parsedPrice : null,
      currency,
      inventory: Number(inventoryValue) || 0,
      isNew: parseBoolean(normalizedRow.is_new) ?? false,
      isBestSeller: parseBoolean(normalizedRow.is_best_seller) ?? false,
      isActive: parseBoolean(normalizedRow.is_active) ?? true,
      qualityScore: quality.score,
      qualityNotes: quality.notes,
      error: errorMessage,
      warnings: warnings.length ? warnings : undefined,
    };

    if (errorMessage) {
      errors.push({
        row: rowNumber,
        title,
        slug: slugInput,
        message: errorMessage,
      });
      if (previewMode) {
        previewRows.push(previewRow);
      }
      continue;
    }

    if (previewMode) {
      previewRows.push(previewRow);
      continue;
    }

    try {
      const qualityNotes = quality.notes.length ? quality.notes.join("; ") : null;
      await prisma.product.create({
        data: {
          titleEn: title,
          slug,
          descriptionEn: description,
          categoryId,
          price: new Prisma.Decimal(parsedPrice),
          currency,
          inventory: Number(inventoryValue) || 0,
          tags,
          isNew: parseBoolean(normalizedRow.is_new) ?? false,
          isBestSeller: parseBoolean(normalizedRow.is_best_seller) ?? false,
          isActive: parseBoolean(normalizedRow.is_active) ?? true,
          qaStatus: "PENDING",
          qualityScore: quality.score,
          qualityNotes,
          images: imageUrls.length
            ? {
                create: imageUrls.map((url, imgIndex) => ({
                  url,
                  alt: title,
                  sortOrder: imgIndex,
                  isCover: imgIndex === 0,
                })),
              }
            : undefined,
        },
      });
      created += 1;
    } catch (error) {
      errors.push({
        row: index + 2,
        title,
        slug: slugInput,
        message: error instanceof Error ? error.message : "Failed to create product.",
      });
    }
  }

  if (previewMode) {
    let previewTokenValue = "";
    try {
      const ttlSeconds = Number(process.env.AI_PREVIEW_TTL_SECONDS ?? 3600);
      previewTokenValue = signPreviewRows(previewRows, ttlSeconds);
    } catch (error) {
      logApiWarning(ctx, 400, { reason: "preview_token_failed" });
      return jsonError(error instanceof Error ? error.message : "Unable to sign preview", 400, ctx, {
        code: "PREVIEW_TOKEN_ERROR",
      });
    }

    logApiSuccess(ctx, 200, {
      preview: previewRows.length,
      errors: errors.length,
      aiMode,
      previewMode,
    });
    return jsonOk(
      {
        preview: previewRows,
        errors,
        errorsCsv: errors.length ? errorsToCsv(errors) : "",
        previewToken: previewTokenValue,
        estimate: aiEstimate,
      },
      ctx,
    );
  }

  logApiSuccess(ctx, 200, {
    created,
    errors: errors.length,
    aiMode,
    previewMode,
    usePreviewResults,
  });
  return jsonOk(
    {
      created,
      failed: errors.length,
      errors,
      errorsCsv: errors.length ? errorsToCsv(errors) : "",
    },
    ctx,
  );
}
