/**
 * Inflyway 商品管理 API
 * 用于在 Inflyway 平台创建和管理商品
 */
import { resolveInflywayToken } from "@/lib/inflyway/runtime-token-store";

const INFLYWAY_API_BASE = "https://inflyway.com";
const CREATE_PRODUCT_ENDPOINT = "/flylink/client/goods/add";

function stripWrappingQuotes(value: string) {
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

function readEnvString(value: string | undefined) {
  return value ? stripWrappingQuotes(value) : "";
}

function normalizeImageRef(value: string | undefined) {
  const trimmed = readEnvString(value);
  if (!trimmed) return "";
  if (trimmed.startsWith("/flylink/")) return trimmed.slice(1);
  const match = trimmed.match(/\/(flylink\/[^?#]+)/i);
  if (match?.[1]) return match[1];
  return trimmed;
}

function isLikelyInflywayImageRef(value: string) {
  return /^flylink\/.+/i.test(value);
}

export type CreateProductParams = {
  title: string;
  price: number;
  stock?: number;
  currency?: string;
  categoryId?: number;
  categoryName?: string;
  description?: string;
  imageUrl?: string;
  contact?: {
    email?: string;
    mobile?: string;
    whatsApp?: string;
    instagram?: string;
    telegram?: string;
    skype?: string;
    facebook?: string;
    snapchat?: string;
    discord?: string;
    line?: string;
    viber?: string;
  };
};

export type CreateProductResult = {
  success: boolean;
  productId?: string;
  goodsNo?: string;
  skuCode?: string;
  error?: string;
};

function normalizeId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function pickFirstId(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeId(value);
    if (normalized) return normalized;
  }
  return undefined;
}

function parsePossiblyJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function collectStringIdsByKey(value: unknown, keys: Set<string>, out: string[] = []): string[] {
  const parsed = parsePossiblyJson(value);
  if (parsed == null) return out;

  if (Array.isArray(parsed)) {
    for (const item of parsed) collectStringIdsByKey(item, keys, out);
    return out;
  }

  if (typeof parsed !== "object") return out;

  for (const [key, nested] of Object.entries(parsed as Record<string, unknown>)) {
    if (keys.has(key)) {
      const normalized = normalizeId(nested);
      if (normalized) out.push(normalized);
      const reparsed = parsePossiblyJson(nested);
      if (reparsed !== nested) collectStringIdsByKey(reparsed, keys, out);
    }
    collectStringIdsByKey(nested, keys, out);
  }
  return out;
}

function pickNestedId(value: unknown, ...keys: string[]) {
  const matches = collectStringIdsByKey(value, new Set(keys));
  return pickFirstId(...matches);
}

// 默认联系方式（从环境变量读取）
const DEFAULT_CONTACT = {
  email: readEnvString(process.env.INFLYWAY_CONTACT_EMAIL),
  mobile: readEnvString(process.env.INFLYWAY_CONTACT_MOBILE),
  whatsApp: readEnvString(process.env.INFLYWAY_CONTACT_WHATSAPP),
};

// 默认商品图片
const DEFAULT_IMAGE = readEnvString(process.env.INFLYWAY_DEFAULT_IMAGE);

/**
 * 获取认证 Token
 */
async function getToken(): Promise<string> {
  const resolved = await resolveInflywayToken();
  if (!resolved.token) {
    throw new Error("No available Inflyway token");
  }
  return resolved.token;
}

/**
 * 构建请求头
 */
function buildHeaders(token: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "zh",
    "content-type": "application/json;charset=UTF-8",
    authorization: token,
    token: token,
    access_token_id: token,
    accesstoken: token,
  };
}

/**
 * 构建创建商品的请求体
 */
function buildCreateProductBody(params: CreateProductParams) {
  const contact = { ...DEFAULT_CONTACT, ...params.contact };
  const requestedImage = normalizeImageRef(params.imageUrl);
  const defaultImage = normalizeImageRef(DEFAULT_IMAGE);
  const imageUrl =
    (requestedImage && isLikelyInflywayImageRef(requestedImage) ? requestedImage : "") ||
    defaultImage ||
    requestedImage;

  return {
    categoryId: params.categoryId ?? 26,
    goodsTitle: params.title,
    categoryName: params.categoryName ?? "其他",
    goodsImageList: imageUrl
      ? [{ imageUrl, firstImage: 1 }]
      : [],
    goodsDesc: params.description
      ? `<p>${params.description}</p>`
      : "<p></p>",
    specList: [],
    specIdForGroup: "",
    skuList: [
      {
        salePrice: String(params.price),
        saleCurrency: params.currency ?? "USD",
        stock: String(params.stock ?? 1),
      },
    ],
    licenceIdList: [],
    licenceRemark: "",
    contactEmail: contact.email,
    contactMobile: contact.mobile,
    contactWhatsApp: contact.whatsApp,
    contactInstagram: contact.instagram ?? "",
    contactSkype: contact.skype ?? "",
    contactFaceBook: contact.facebook ?? "",
    contactTelegram: contact.telegram ?? "",
    contactSnapchat: contact.snapchat ?? "",
    contactDiscord: contact.discord ?? "",
    contactLine: contact.line ?? "",
    contactViber: contact.viber ?? "",
    recommPageShow: 1,
    needMarketing: 0,
    enableDistribution: 0,
    commissionRatePro: 0,
    relateId: null,
    useAiTools: false,
  };
}

/**
 * 在 Inflyway 平台创建商品
 */
export async function createInflywayProduct(
  params: CreateProductParams
): Promise<CreateProductResult> {
  const url = `${INFLYWAY_API_BASE}${CREATE_PRODUCT_ENDPOINT}`;

  console.log(
    `[inflyway][product] Creating product: ${params.title}, price=${params.price} ${params.currency || "USD"}`
  );

  try {
    const requestedImage = normalizeImageRef(params.imageUrl);
    const defaultImage = normalizeImageRef(DEFAULT_IMAGE);
    if (!requestedImage && !defaultImage) {
      return {
        success: false,
        error:
          "Missing product image for Inflyway dynamic product. Please set INFLYWAY_DEFAULT_IMAGE to a valid flylink/... image path.",
      };
    }

    const token = await getToken();
    const headers = buildHeaders(token);
    const body = buildCreateProductBody(params);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data?.success === true || data?.code === "000000") {
      const payload = data?.data;
      const payloadObj =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : null;
      const parsedData = parsePossiblyJson(data);
      const parsedPayload = parsePossiblyJson(payload);

      // When API returns a string, it is commonly the goodsNo/id.
      const productId = pickFirstId(
        typeof payload === "string" ? payload : undefined,
        payloadObj?.id,
        payloadObj?.goodsId,
        payloadObj?.goodsNo,
        pickNestedId(parsedPayload, "id", "goodsId", "goodsNo"),
        pickNestedId(parsedData, "id", "goodsId", "goodsNo"),
        data?.goodsId,
        data?.goodsNo,
      );

      const goodsNo = pickFirstId(
        payloadObj?.goodsNo,
        payloadObj?.goodsId,
        payloadObj?.id,
        pickNestedId(parsedPayload, "goodsNo"),
        pickNestedId(parsedData, "goodsNo"),
        typeof payload === "string" ? payload : undefined,
        data?.goodsNo,
        data?.goodsId,
      );

      const skuCode = pickFirstId(
        payloadObj?.skuCode,
        payloadObj?.skuNo,
        payloadObj?.skuId,
        (payloadObj as any)?.skuList?.[0]?.skuCode,
        (payloadObj as any)?.skuList?.[0]?.skuNo,
        (payloadObj as any)?.skuList?.[0]?.id,
        pickNestedId(parsedPayload, "skuCode", "skuNo", "skuId"),
        pickNestedId(parsedData, "skuCode", "skuNo", "skuId"),
        data?.skuCode,
        data?.skuNo,
      );

      console.log(
        `[inflyway][product] Product created: ${productId} (goodsNo=${goodsNo ?? "-"}, skuCode=${skuCode ?? "-"})`
      );
      return {
        success: true,
        productId,
        goodsNo,
        skuCode,
      };
    }

    const errorMessage = data?.desc || data?.message || "Failed to create product";
    console.error(`[inflyway][product] Creation failed: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    console.error("[inflyway][product] Creation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 批量创建商品
 */
export async function createInflywayProductsBatch(
  products: CreateProductParams[]
): Promise<{ results: CreateProductResult[]; successCount: number; failCount: number }> {
  const results: CreateProductResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    const result = await createInflywayProduct(product);
    results.push(result);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    // 添加延迟避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(
    `[inflyway][product] Batch complete: ${successCount} success, ${failCount} failed`
  );

  return { results, successCount, failCount };
}
