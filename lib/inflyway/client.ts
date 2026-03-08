/**
 * Inflyway API 客户端
 * 通过 HTTP API 创建快捷订单并获取支付链接
 */
import { resolveInflywayToken } from "@/lib/inflyway/runtime-token-store";

export type CreateOrderParams = {
  amount: number;
  currency?: string;
  orderNote?: string;
  shippingInfo?: ShippingInfoInput;
  traceId?: string;
  goodsNo?: string;
  skuCode?: string;
  unitPrice?: number;
};

export type CreateOrderResult = {
  success: boolean;
  orderId?: string;
  orderUrl?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  error?: string;
};

export type ShippingInfoInput = {
  fullName?: string;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
};

export type TemplateSkuConfig = {
  goodsNo: string;
  skuCode: string;
  unitPrice?: number;
  label?: string;
};

const INFLYWAY_API_BASE = "https://inflyway.com";
const CREATE_ORDER_ENDPOINT = "/flylink/client/order/createQuickOrder";
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

function parseBooleanEnv(value: string | undefined) {
  const normalized = readEnvString(value).toLowerCase();
  if (!normalized) return false;
  return ["1", "true", "yes", "on"].includes(normalized);
}

const INFLYWAY_DEBUG = parseBooleanEnv(process.env.INFLYWAY_DEBUG);

// 通用商品配置（单价 1 USD）
const DEFAULT_GOODS_NO = readEnvString(process.env.INFLYWAY_GOODS_NO) || "GPYP9ZNHM9";
const DEFAULT_SKU_CODE =
  readEnvString(process.env.INFLYWAY_SKU_CODE) || "20260123000000037560";
const DEFAULT_UNIT_PRICE = Number(readEnvString(process.env.INFLYWAY_UNIT_PRICE) || "0.01");
const ORDER_NOTE_FIELD =
  (readEnvString(process.env.INFLYWAY_ORDER_NOTE_FIELD) || "orderNote").trim() ||
  "orderNote";
const ORDER_NOTE_FALLBACK_FIELDS = (readEnvString(process.env.INFLYWAY_ORDER_NOTE_FIELDS) ||
  "orderNote,remark,orderRemark,orderDesc,note,desc").split(",").map((field) => field.trim()).filter(Boolean);
const ADMIN_ORDER_PATH_PATTERNS = [
  /\/#\/kn\/fly-link\/orders/i,
  /\/kamelnet\/#\/kn\/fly-link\/orders/i,
  /\/fly-link\/orders(?:\/add)?/i,
];
const COUNTRY_CODE_MAP: Record<string, string> = {
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  USA: "US",
  US: "US",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  ENGLAND: "GB",
  GREATBRITAIN: "GB",
  "GREAT BRITAIN": "GB",
  CHINA: "CN",
  PRC: "CN",
  BRAZIL: "BR",
  MEXICO: "MX",
  CANADA: "CA",
  AUSTRALIA: "AU",
  GERMANY: "DE",
  FRANCE: "FR",
  ITALY: "IT",
  SPAIN: "ES",
  JAPAN: "JP",
  KOREA: "KR",
  "SOUTH KOREA": "KR",
  INDIA: "IN",
  SINGAPORE: "SG",
  HONGKONG: "HK",
  "HONG KONG": "HK",
};

function normalizeCountry(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (COUNTRY_CODE_MAP[upper]) return COUNTRY_CODE_MAP[upper];
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return trimmed;
}

function splitName(fullName?: string) {
  const cleaned = fullName?.trim();
  if (!cleaned) return { firstName: undefined, lastName: undefined };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: undefined };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function buildStateId(country?: string, state?: string) {
  if (!country || !state) return undefined;
  const countryCode = /^[A-Z]{2}$/.test(country) ? country : undefined;
  if (!countryCode) return undefined;
  const cleanedState = state.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (!cleanedState || cleanedState.length > 4) return undefined;
  return `${countryCode}${cleanedState}`;
}

function splitCallingCode(value?: string) {
  if (!value) return { callingCode: undefined, phoneNumber: undefined };
  const trimmed = value.trim();
  if (!trimmed) return { callingCode: undefined, phoneNumber: undefined };
  const match = trimmed.match(/^\+(\d+)\s*(.*)$/);
  if (match) {
    const number = match[2]?.replace(/[^\d]/g, "") ?? "";
    return {
      callingCode: match[1],
      phoneNumber: number || undefined,
    };
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  return { callingCode: undefined, phoneNumber: digits || undefined };
}

function compactRecord<T extends Record<string, unknown>>(record: T) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null || value === "") continue;
    output[key] = value;
  }
  return output as Partial<T>;
}

function buildShippingInfo(input?: ShippingInfoInput) {
  if (!input) return undefined;
  const fullName = input.fullName?.trim();
  const addressLine = input.address1?.trim();
  const country = normalizeCountry(input.country);
  if (!fullName || !addressLine || !country) return undefined;

  const { firstName, lastName } = splitName(fullName);
  const state = input.state?.trim();
  const city = input.city?.trim();
  const postalCode = input.postalCode?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim();
  const stateId = buildStateId(country, state);
  const { callingCode, phoneNumber } = splitCallingCode(phone);
  const phoneValue = phoneNumber ?? phone;

  return compactRecord({
    firstName,
    lastName,
    receiverName: fullName,
    receiverPhone: phoneValue,
    phone: phoneValue,
    country,
    addressLine,
    addressLine2: input.address2?.trim(),
    city,
    zipcode: postalCode,
    state,
    stateId,
    callingCodeCountry: /^[A-Z]{2}$/.test(country) ? country : undefined,
    callingCode,
    email,
    saveBuyerShipping: true,
  });
}

/**
 * 获取认证 Token
 */
async function getToken(): Promise<string> {
  const resolved = await resolveInflywayToken();
  if (!resolved.token) {
    throw new Error("No available Inflyway token (runtime store and env both empty)");
  }
  return resolved.token;
}

/**
 * 构建请求头
 */
function buildHeadersWithToken(token: string): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json;charset=UTF-8",
    authorization: token,
    token: token,
    access_token_id: token,
    accesstoken: token,
    "accept-language": "zh",
  };
}

async function buildHeaders() {
  const token = await getToken();
  return buildHeadersWithToken(token);
}

/**
 * 构建创建订单的请求体
 */
function buildCreateOrderBody(params: CreateOrderParams) {
  const { amount, currency = "USD" } = params;
  const roundedAmount = Math.max(0.01, Number(amount.toFixed(2)));
  const useTemplateSku =
    readEnvString(params.goodsNo) !== "" && readEnvString(params.skuCode) !== "";
  const goodsNo = useTemplateSku ? readEnvString(params.goodsNo) : DEFAULT_GOODS_NO;
  const skuCode = useTemplateSku ? readEnvString(params.skuCode) : DEFAULT_SKU_CODE;
  const configuredUnitPrice =
    typeof params.unitPrice === "number" && Number.isFinite(params.unitPrice)
      ? params.unitPrice
      : DEFAULT_UNIT_PRICE;
  const unitPrice =
    Number.isFinite(configuredUnitPrice) && configuredUnitPrice > 0
      ? Number(configuredUnitPrice.toFixed(2))
      : 0.01;
  const quantityExact = roundedAmount / unitPrice;
  const quantity = Math.max(1, Math.round(quantityExact));
  if (Math.abs(quantityExact - quantity) > 0.0001) {
    throw new Error(
      `Amount ${roundedAmount} is not divisible by unit price ${unitPrice}. Update INFLYWAY_UNIT_PRICE or use a SKU with smaller price.`
    );
  }

  const payload: Record<string, unknown> = {
    goodsSkuListMap: {
      [goodsNo]: [
        {
          skuCode,
          unitPrice,
          paymentCurrency: currency,
          paymentUnitPrice: unitPrice,
          quantity,
        },
      ],
    },
    paymentCurrency: currency,
    paymentAmount: roundedAmount,
    goodsAmount: roundedAmount,
    shippingFeeAmount: 0,
    marginAmount: 0,
    vaAccount: {
      localAccounts: [],
      overseasAccounts: [],
    },
    paymentMethodList: [
      {
        payType: "VISA_MASTER",
        groupText: "卡片",
        text: "信用卡",
        disabled: false,
        payCateId: "P00001",
        payMethodList: [
          {
            payStyleId: "PS0001",
            payStyleName: "VISA",
            currency: [currency],
            region: "Global",
          },
        ],
        payTypeEnum: "VISA_MASTER",
      },
    ],
  };

  if (params.orderNote) {
    payload[ORDER_NOTE_FIELD] = params.orderNote;
    for (const field of ORDER_NOTE_FALLBACK_FIELDS) {
      if (!payload[field]) {
        payload[field] = params.orderNote;
      }
    }
  }

  const shippingInfo = buildShippingInfo(params.shippingInfo);
  if (shippingInfo) {
    payload.shippingInfo = shippingInfo;
  }

  return payload;
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!INFLYWAY_DEBUG) return;
  console.info(`[inflyway][debug] ${label}`, payload);
}

function normalizeUrlCandidate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function isInflywayAdminOrderUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (!/inflyway\.com$/i.test(parsed.hostname)) return false;
  const pathAndHash = `${parsed.pathname}${parsed.hash}`.toLowerCase();
  return ADMIN_ORDER_PATH_PATTERNS.some((pattern) => pattern.test(pathAndHash));
}

function resolveOrderUrl(payload: Record<string, unknown>) {
  const candidates = [
    { key: "paymentLinkUrl", value: normalizeUrlCandidate(payload.paymentLinkUrl) },
    { key: "payUrl", value: normalizeUrlCandidate(payload.payUrl) },
    { key: "payUrlLong", value: normalizeUrlCandidate(payload.payUrlLong) },
    { key: "payUrlShort", value: normalizeUrlCandidate(payload.payUrlShort) },
    { key: "paymentUrl", value: normalizeUrlCandidate(payload.paymentUrl) },
    { key: "qrCodeUrl", value: normalizeUrlCandidate(payload.qrCodeUrl) },
    { key: "orderUrl", value: normalizeUrlCandidate(payload.orderUrl) },
  ].filter((entry): entry is { key: string; value: string } => Boolean(entry.value));

  if (candidates.length === 0) {
    return { orderUrl: null as string | null, sourceField: null as string | null, blockedAdminUrl: false };
  }

  const publicCandidate = candidates.find((entry) => !isInflywayAdminOrderUrl(entry.value));
  if (publicCandidate) {
    return { orderUrl: publicCandidate.value, sourceField: publicCandidate.key, blockedAdminUrl: false };
  }

  return {
    orderUrl: null as string | null,
    sourceField: candidates[0]?.key ?? null,
    blockedAdminUrl: true,
  };
}

/**
 * 创建快捷订单
 */
export async function createInflywayOrder(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  const url = `${INFLYWAY_API_BASE}${CREATE_ORDER_ENDPOINT}`;
  const headers = await buildHeaders();
  const requestMeta = {
    traceId: params.traceId,
    amount: params.amount,
    currency: params.currency ?? "USD",
  };

  console.log(
    `[inflyway] Creating order: amount=${params.amount} ${params.currency || "USD"}`
  );
  debugLog("request", requestMeta);
  debugLog("pricing", {
    traceId: params.traceId,
    amount: params.amount,
    currency: params.currency ?? "USD",
    unitPrice: DEFAULT_UNIT_PRICE,
  });
  if (params.orderNote) {
    debugLog("note", {
      traceId: params.traceId,
      field: ORDER_NOTE_FIELD,
      length: params.orderNote.length,
    });
    debugLog("note_fields", {
      traceId: params.traceId,
      fields: ORDER_NOTE_FALLBACK_FIELDS,
    });
  }

  try {
    const body = buildCreateOrderBody(params);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
      debugLog("response_parse_error", {
        ...requestMeta,
        status: response.status,
        rawText: rawText?.slice(0, 2000),
      });
      throw parseError;
    }

    const ok =
      data?.success === true ||
      data?.code === 0 ||
      data?.code === "0" ||
      data?.code === "000000";
    const payload = data?.data ?? {};
    const orderId =
      payload.orderId ??
      payload.orderNo ??
      payload.orderNumber ??
      payload.id;
    const { orderUrl, sourceField, blockedAdminUrl } = resolveOrderUrl(payload);

    debugLog("response", {
      ...requestMeta,
      status: response.status,
      ok,
      orderId,
      hasOrderUrl: Boolean(orderUrl),
      orderUrlField: sourceField,
      blockedAdminUrl,
      code: data?.code,
      error: data?.desc || data?.message,
    });

    if (ok && payload) {
      if (!orderUrl) {
        const errorMessage = blockedAdminUrl
          ? "Inflyway returned an internal order URL. Public payment link unavailable."
          : "Payment link missing in Inflyway response";
        console.warn("[inflyway] Missing usable payment URL", {
          traceId: params.traceId,
          orderId,
          sourceField,
          blockedAdminUrl,
        });
        debugLog("missing_payment_link", {
          ...requestMeta,
          orderId,
          sourceField,
          blockedAdminUrl,
          payload,
        });
        return {
          success: false,
          orderId,
          error: errorMessage,
          paymentAmount: payload.paymentAmount ?? payload.amount,
          paymentCurrency: payload.paymentCurrency ?? payload.currency,
        };
      }
      if (orderId) {
        console.log(`[inflyway] Order created: ${orderId}`);
      }
      return {
        success: true,
        orderId,
        orderUrl,
        paymentAmount: payload.paymentAmount ?? payload.amount,
        paymentCurrency: payload.paymentCurrency ?? payload.currency,
      };
    }

    const errorMessage = data?.desc || data?.message || "Failed to create order";
    console.error(`[inflyway] Order creation failed: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    console.error("[inflyway] Order creation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 检查 Token 是否有效
 */
export async function checkTokenValid(): Promise<boolean> {
  const result = await checkInflywayTokenHealth();
  return result.ok;
}

export type InflywayTokenHealthResult = {
  ok: boolean;
  status: number;
  code?: string;
  message?: string;
  error?: string;
};

export async function checkInflywayTokenHealth(
  tokenOverride?: string,
): Promise<InflywayTokenHealthResult> {
  const url = `${INFLYWAY_API_BASE}/flylink/client/order/qryOrderListClientPage`;
  try {
    const token = tokenOverride ?? (await getToken());
    const headers = buildHeadersWithToken(token);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ pageSize: 1, pageNo: 1, recycleStatus: 1 }),
    });
    const data = await response.json().catch(() => ({}));
    return {
      ok: data?.success === true || data?.code === "000000",
      status: response.status,
      code: typeof data?.code === "string" ? data.code : undefined,
      message:
        typeof data?.desc === "string"
          ? data.desc
          : typeof data?.message === "string"
            ? data.message
            : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "health check request failed",
    };
  }
}

/**
 * 动态商品模式的订单参数
 */
export type CreateOrderWithProductParams = CreateOrderParams & {
  /** 商品标题（通常是订单号） */
  productTitle: string;
  /** 商品描述 */
  productDescription?: string;
  /** 商品图片 URL */
  productImageUrl?: string;
  /** 镜像商品失败时，回退到类目模板商品池 */
  fallbackTemplateSku?: TemplateSkuConfig;
};

/**
 * 创建订单（动态商品模式）
 * 1. 先在 Inflyway 创建一个商品（标题=订单号，价格=订单金额）
 * 2. 用这个新商品创建快捷订单
 * 3. 返回支付链接
 */
export async function createInflywayOrderWithProduct(
  params: CreateOrderWithProductParams
): Promise<CreateOrderResult> {
  const { createInflywayProduct } = await import("@/lib/inflyway/product");

  console.log(
    `[inflyway] Creating order with dynamic product: ${params.productTitle}, amount=${params.amount} ${params.currency || "USD"}`
  );

  const buildFallbackOrderParams = (overrides?: Partial<CreateOrderParams>): CreateOrderParams => ({
    amount: params.amount,
    currency: params.currency,
    traceId: params.traceId,
    orderNote: params.orderNote,
    shippingInfo: params.shippingInfo,
    ...overrides,
  });

  const createFallbackOrder = async (reason: string, previousError?: string): Promise<CreateOrderResult> => {
    const templateGoodsNo = readEnvString(params.fallbackTemplateSku?.goodsNo);
    const templateSkuCode = readEnvString(params.fallbackTemplateSku?.skuCode);
    const templateLabel = readEnvString(params.fallbackTemplateSku?.label) || "category-template";
    const hasTemplate = Boolean(templateGoodsNo && templateSkuCode);

    if (hasTemplate) {
      console.warn(
        `[inflyway] Dynamic product failed (${reason}); falling back to template SKU (${templateLabel})`
      );
      const templateResult = await createInflywayOrder(
        buildFallbackOrderParams({
          goodsNo: templateGoodsNo,
          skuCode: templateSkuCode,
          unitPrice: params.fallbackTemplateSku?.unitPrice,
        })
      );
      if (templateResult.success) {
        console.log(`[inflyway] Fallback order created with template SKU (${templateLabel})`);
        return templateResult;
      }
      const defaultResult = await createInflywayOrder(buildFallbackOrderParams());
      if (defaultResult.success) {
        console.log("[inflyway] Template fallback failed; default goods fallback succeeded");
        return defaultResult;
      }
      return {
        success: false,
        orderId: templateResult.orderId ?? defaultResult.orderId,
        error: `${previousError || reason}; template fallback failed: ${
          templateResult.error || "unknown error"
        }; default fallback failed: ${defaultResult.error || "unknown error"}`,
      };
    }

    console.warn("[inflyway] Template SKU not configured; falling back to default goods");
    const defaultResult = await createInflywayOrder(buildFallbackOrderParams());
    if (defaultResult.success) {
      return defaultResult;
    }
    return {
      success: false,
      orderId: defaultResult.orderId,
      error: `${previousError || reason}; default fallback failed: ${defaultResult.error || "unknown error"}`,
    };
  };

  // Step 1: 创建商品
  const productResult = await createInflywayProduct({
    title: params.productTitle,
    price: params.amount,
    stock: 1,
    currency: params.currency || "USD",
    description: params.productDescription,
    imageUrl: params.productImageUrl,
  });

  if (!productResult.success) {
    console.error(`[inflyway] Failed to create product: ${productResult.error}`);
    return createFallbackOrder("dynamic_product_create_failed", productResult.error);
  }

  console.log(`[inflyway] Product created: ${productResult.productId}`);

  // Step 2: 使用新创建的商品创建订单
  // 注意：由于 Inflyway API 创建商品后只返回 productId，
  // 我们需要使用 productId 作为 goodsNo，并构造 skuCode
  const goodsNo = productResult.goodsNo || productResult.productId;
  const skuCode = productResult.skuCode || productResult.productId;

  if (!goodsNo || !skuCode) {
    console.error("[inflyway] Missing goodsNo or skuCode from product creation");
    return {
      success: false,
      error: "Product created but missing goodsNo/skuCode for order creation",
    };
  }

  // 构建使用动态商品的订单请求体
  const url = `${INFLYWAY_API_BASE}${CREATE_ORDER_ENDPOINT}`;
  const headers = await buildHeaders();
  const { amount, currency = "USD" } = params;
  const roundedAmount = Math.max(0.01, Number(amount.toFixed(2)));

  const payload: Record<string, unknown> = {
    goodsSkuListMap: {
      [goodsNo]: [
        {
          skuCode,
          unitPrice: roundedAmount,
          paymentCurrency: currency,
          paymentUnitPrice: roundedAmount,
          quantity: 1,
        },
      ],
    },
    paymentCurrency: currency,
    paymentAmount: roundedAmount,
    goodsAmount: roundedAmount,
    shippingFeeAmount: 0,
    marginAmount: 0,
    vaAccount: {
      localAccounts: [],
      overseasAccounts: [],
    },
    paymentMethodList: [
      {
        payType: "VISA_MASTER",
        groupText: "卡片",
        text: "信用卡",
        disabled: false,
        payCateId: "P00001",
        payMethodList: [
          {
            payStyleId: "PS0001",
            payStyleName: "VISA",
            currency: [currency],
            region: "Global",
          },
        ],
        payTypeEnum: "VISA_MASTER",
      },
    ],
  };

  if (params.orderNote) {
    payload[ORDER_NOTE_FIELD] = params.orderNote;
    for (const field of ORDER_NOTE_FALLBACK_FIELDS) {
      if (!payload[field]) {
        payload[field] = params.orderNote;
      }
    }
  }

  const shippingInfo = buildShippingInfo(params.shippingInfo);
  if (shippingInfo) {
    payload.shippingInfo = shippingInfo;
  }

  try {
    const tryCreateOrder = async () => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      const ok =
        data?.success === true ||
        data?.code === 0 ||
        data?.code === "0" ||
        data?.code === "000000";
      const responsePayload = data?.data ?? {};
      const orderId =
        responsePayload.orderId ??
        responsePayload.orderNo ??
        responsePayload.orderNumber ??
        responsePayload.id;
      const { orderUrl } = resolveOrderUrl(responsePayload);
      const errorMessage = data?.desc || data?.message || "Failed to create order";

      return {
        ok,
        data,
        responsePayload,
        orderId,
        orderUrl,
        errorMessage,
      };
    };

    let attemptResult = await tryCreateOrder();
    for (
      let retry = 0;
      !attemptResult.ok &&
      typeof attemptResult.errorMessage === "string" &&
      attemptResult.errorMessage.includes("商品信息不存在") &&
      retry < 3;
      retry += 1
    ) {
      const delayMs = 800 * (retry + 1);
      console.warn(
        `[inflyway] Dynamic product not ready yet (goodsNo=${goodsNo}, skuCode=${skuCode}), retrying in ${delayMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attemptResult = await tryCreateOrder();
    }

    if (attemptResult.ok && attemptResult.orderUrl) {
      console.log(`[inflyway] Order created with dynamic product: ${attemptResult.orderId}`);
      return {
        success: true,
        orderId: attemptResult.orderId,
        orderUrl: attemptResult.orderUrl,
        paymentAmount:
          attemptResult.responsePayload.paymentAmount ?? attemptResult.responsePayload.amount,
        paymentCurrency:
          attemptResult.responsePayload.paymentCurrency ?? attemptResult.responsePayload.currency,
      };
    }

    const isProductNotFound =
      typeof attemptResult.errorMessage === "string" &&
      attemptResult.errorMessage.includes("商品信息不存在");

    if (isProductNotFound) {
      return createFallbackOrder("dynamic_product_not_ready", attemptResult.errorMessage);
    }

    console.error(
      `[inflyway] Order creation failed: ${attemptResult.errorMessage} (goodsNo=${goodsNo}, skuCode=${skuCode})`
    );
    return {
      success: false,
      orderId: attemptResult.orderId,
      error: attemptResult.errorMessage,
    };
  } catch (error) {
    console.error("[inflyway] Order creation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
