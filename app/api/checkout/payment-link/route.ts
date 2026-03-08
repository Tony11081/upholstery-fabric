/**
 * POST /api/checkout/payment-link
 * 创建订单并通过 Inflyway API 生成支付链接
 */

import { OrderStatus, Prisma } from "@prisma/client";
import { createOrder } from "@/lib/data/orders";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildPaymentLinkEmail, buildRequestReceivedEmail } from "@/lib/email/templates";
import { isInvoiceMode } from "@/lib/utils/env";
import { generateRequestNumber, safeJson } from "@/lib/utils/stripe";
import { calculateShipping } from "@/lib/utils/shipping";
import { getSiteUrl } from "@/lib/utils/site";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
  maskEmail,
} from "@/lib/utils/api";
import {
  applyDiscount,
  getActiveDiscounts,
  resolveDiscountPercent,
} from "@/lib/utils/discounts";
import { createInflywayOrder, createInflywayOrderWithProduct } from "@/lib/inflyway/client";
import { buildInflywayOrderNote } from "@/lib/inflyway/order-note";
import {
  ensureInflywayAutoRefreshStarted,
  triggerInflywayHealthCheck,
} from "@/lib/inflyway/auto-refresh";
import { resolveInflywayToken } from "@/lib/inflyway/runtime-token-store";
import {
  recordPaymentLinkApiOutcome,
  recordPaymentLinkProviderOutcome,
} from "@/lib/inflyway/payment-link-metrics";

type RequestBody = {
  items: Array<{
    productId: string;
    quantity: number;
    options?: Record<string, string>;
  }>;
  address: {
    email: string;
    fullName: string;
    phone?: string;
    country: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  shipping?: {
    method: string;
    price: number;
  };
  referralCode?: string;
  utm?: Prisma.InputJsonValue;
  source?: string;
  idempotencyKey?: string;
};

const OPTION_LABELS: Record<string, string> = {
  color: "Color",
  size: "Size",
};

const formatOptions = (options?: Record<string, string>) => {
  if (!options) return "";
  const entries = Object.entries(options).filter(([, value]) => value);
  if (!entries.length) return "";
  return entries
    .map(([key, value]) => `${OPTION_LABELS[key] ?? key}: ${value}`)
    .join(", ");
};

const formatProviderSafeOptions = (options?: Record<string, string>) => {
  if (!options) return "";
  const safeEntries = Object.entries(options).filter(
    ([key, value]) => value && (key === "color" || key === "size")
  );
  if (!safeEntries.length) return "";
  return safeEntries
    .map(([key, value]) => `${OPTION_LABELS[key] ?? key}: ${value}`)
    .join(", ");
};

const PAYMENT_LINK_WAIT_MS = 15000;
const PAYMENT_LINK_POLL_MS = 1000;
const CHECKOUT_PROVIDER_NAME = "Inflyway Hosted Checkout";

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

function resolveCheckoutHost(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function buildTrackUrlForOrder(request: Request, orderNumber: string, email: string) {
  const siteUrl = getSiteUrl(request.headers.get("origin") ?? undefined);
  return `${siteUrl}/track-order?orderNumber=${orderNumber}&email=${encodeURIComponent(email)}`;
}

type RequestEmailItem = {
  title: string;
  qty: number;
  price: number;
  currency: string;
};

async function sendRequestReceivedEmailSafe(input: {
  orderNumber: string;
  email: string;
  trackUrl: string;
  items: RequestEmailItem[];
}) {
  const emailTemplate = buildRequestReceivedEmail({
    orderNumber: input.orderNumber,
    email: input.email,
    items: input.items,
    trackUrl: input.trackUrl,
  });
  try {
    await sendEmail({
      to: input.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
  } catch (emailError) {
    console.warn("[payment-link] Request received email failed:", emailError);
  }
}

function readEnvString(value?: string | null) {
  if (value == null) return "";
  return stripWrappingQuotes(String(value));
}

function normalizeInflywayImageRef(value?: string | null) {
  const trimmed = readEnvString(value);
  if (!trimmed) return "";
  if (trimmed.startsWith("/flylink/")) return trimmed.slice(1);
  const match = trimmed.match(/\/(flylink\/[^?#]+)/i);
  if (match?.[1]) return match[1];
  return trimmed;
}

function isInflywayImageRef(value?: string | null) {
  return /^flylink\/.+/i.test(readEnvString(value ?? ""));
}

function parseBooleanEnv(value?: string | null) {
  if (value == null) return false;
  const normalized = stripWrappingQuotes(value).toLowerCase();
  if (!normalized) return false;
  return ["1", "true", "yes", "on"].includes(normalized);
}

const INFLYWAY_DEBUG = parseBooleanEnv(process.env.INFLYWAY_DEBUG);
// 是否使用动态商品模式（每个订单创建独立商品）
const USE_DYNAMIC_PRODUCT = parseBooleanEnv(process.env.INFLYWAY_USE_DYNAMIC_PRODUCT);

type CheckoutDbProduct = {
  id: string;
  titleEn: string;
  price: Prisma.Decimal;
  currency: string;
  categoryId: string | null;
  tags: string[];
  images: Array<{ url: string }>;
  category?: { slug: string; nameEn: string } | null;
};

const checkoutProductSelect = {
  id: true,
  titleEn: true,
  price: true,
  currency: true,
  categoryId: true,
  tags: true,
  images: {
    select: {
      url: true,
    },
  },
  category: {
    select: {
      slug: true,
      nameEn: true,
    },
  },
} satisfies Prisma.ProductSelect;

type ProductGroup = "bag" | "shoes" | "clothing" | "accessory" | "other";

function classifyProductGroup(product: Pick<CheckoutDbProduct, "titleEn" | "tags" | "category">): ProductGroup {
  const haystack = [
    product.titleEn,
    ...(product.tags ?? []),
    product.category?.slug,
    product.category?.nameEn,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(bag|handbag|tote|shoulder bag|crossbody|backpack|wallet|pouch|clutch)\b/.test(haystack) ||
    /包|手袋|背包|钱包|斜挎/.test(haystack)
  ) {
    return "bag";
  }
  if (
    /\b(shoe|sneaker|loafer|heel|boot|sandal|slide)\b/.test(haystack) ||
    /鞋|靴|凉鞋|运动鞋/.test(haystack)
  ) {
    return "shoes";
  }
  if (
    /\b(dress|coat|jacket|shirt|t-shirt|tee|hoodie|sweater|pants|jeans|skirt|top)\b/.test(haystack) ||
    /衣|裙|裤|外套|上衣|衬衫/.test(haystack)
  ) {
    return "clothing";
  }
  if (
    /\b(jewelry|watch|belt|scarf|hat|cap|sunglass|glasses|accessor)/.test(haystack) ||
    /饰品|首饰|手表|腰带|围巾|帽/.test(haystack)
  ) {
    return "accessory";
  }
  return "other";
}

function providerSafeCategoryLabel(group: ProductGroup) {
  switch (group) {
    case "bag":
      return "Bag Item";
    case "shoes":
      return "Shoes Item";
    case "clothing":
      return "Clothing Item";
    case "accessory":
      return "Accessory Item";
    default:
      return "Fashion Item";
  }
}

function providerSafeMirrorCategoryTitle(group: ProductGroup) {
  switch (group) {
    case "bag":
      return "Handbag";
    case "shoes":
      return "Shoes";
    case "clothing":
      return "Clothing";
    case "accessory":
      return "Accessory";
    default:
      return "Fashion Item";
  }
}

function scoreOrderGroups(items: RequestBody["items"], products: CheckoutDbProduct[]) {
  const score: Record<ProductGroup, number> = {
    bag: 0,
    shoes: 0,
    clothing: 0,
    accessory: 0,
    other: 0,
  };
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const group = product ? classifyProductGroup(product) : "other";
    score[group] += Math.max(1, item.quantity || 1);
  }
  return score;
}

function resolveDominantProductGroup(
  items: RequestBody["items"],
  products: CheckoutDbProduct[]
): ProductGroup {
  const score = scoreOrderGroups(items, products);
  const rankedGroups = (Object.keys(score) as ProductGroup[]).sort((a, b) => score[b] - score[a]);
  return rankedGroups[0] ?? "other";
}

function resolveTemplateSkuForGroup(group: ProductGroup) {
  const goodsNoByGroup: Record<ProductGroup, string> = {
    bag: readEnvString(process.env.INFLYWAY_TEMPLATE_GOODS_BAG_NO),
    shoes: readEnvString(process.env.INFLYWAY_TEMPLATE_GOODS_SHOES_NO),
    clothing: readEnvString(process.env.INFLYWAY_TEMPLATE_GOODS_CLOTHING_NO),
    accessory: readEnvString(process.env.INFLYWAY_TEMPLATE_GOODS_ACCESSORY_NO),
    other: readEnvString(process.env.INFLYWAY_TEMPLATE_GOODS_DEFAULT_NO),
  };
  const skuCodeByGroup: Record<ProductGroup, string> = {
    bag: readEnvString(process.env.INFLYWAY_TEMPLATE_SKU_BAG_CODE),
    shoes: readEnvString(process.env.INFLYWAY_TEMPLATE_SKU_SHOES_CODE),
    clothing: readEnvString(process.env.INFLYWAY_TEMPLATE_SKU_CLOTHING_CODE),
    accessory: readEnvString(process.env.INFLYWAY_TEMPLATE_SKU_ACCESSORY_CODE),
    other: readEnvString(process.env.INFLYWAY_TEMPLATE_SKU_DEFAULT_CODE),
  };

  const goodsNo = goodsNoByGroup[group] || goodsNoByGroup.other;
  const skuCode = skuCodeByGroup[group] || skuCodeByGroup.other;
  if (!goodsNo || !skuCode) return undefined;
  return {
    goodsNo,
    skuCode,
    label: `${group}-template`,
  };
}

function buildProviderSafeNoteItemTitle(
  product: CheckoutDbProduct | undefined,
  options: Record<string, string> | undefined,
  index: number
) {
  const group = product ? classifyProductGroup(product) : "other";
  const base = `${providerSafeCategoryLabel(group)} #${index + 1}`;
  const optionText = formatProviderSafeOptions(options);
  return optionText ? `${base} (${optionText})` : base;
}

function resolveDynamicProductCompliantImage(
  items: RequestBody["items"],
  products: CheckoutDbProduct[]
) {
  const envByGroup: Record<ProductGroup, string> = {
    bag: normalizeInflywayImageRef(process.env.INFLYWAY_CATEGORY_IMAGE_BAG),
    shoes: normalizeInflywayImageRef(process.env.INFLYWAY_CATEGORY_IMAGE_SHOES),
    clothing: normalizeInflywayImageRef(process.env.INFLYWAY_CATEGORY_IMAGE_CLOTHING),
    accessory: normalizeInflywayImageRef(process.env.INFLYWAY_CATEGORY_IMAGE_ACCESSORY),
    other: "",
  };
  const defaultImage = normalizeInflywayImageRef(process.env.INFLYWAY_DEFAULT_IMAGE);

  const score = scoreOrderGroups(items, products);
  const rankedGroups = (Object.keys(score) as ProductGroup[]).sort((a, b) => score[b] - score[a]);
  for (const group of rankedGroups) {
    const imageRef = envByGroup[group];
    if (isInflywayImageRef(imageRef)) return imageRef;
  }

  return isInflywayImageRef(defaultImage) ? defaultImage : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type MetricOutcome = "success" | "failure" | "pending" | "rejected";
type ProviderOutcome = "success" | "failure";

function logInflywayTrace(
  ctx: ReturnType<typeof createApiContext>,
  label: string,
  info?: Record<string, unknown>
) {
  if (!INFLYWAY_DEBUG) return;
  console.info(`[inflyway][trace] ${label} ${ctx.requestId}`, info ?? {});
}

function recordPaymentLinkMetric(
  ctx: ReturnType<typeof createApiContext>,
  outcome: MetricOutcome,
  info?: Record<string, unknown>
) {
  const snapshot = recordPaymentLinkApiOutcome(outcome);
  console.info(`[payment-link][metric] ${ctx.requestId}`, {
    outcome,
    ...snapshot,
    durationMs: Date.now() - ctx.startedAt,
    ...info,
  });
}

function recordProviderMetric(
  ctx: ReturnType<typeof createApiContext>,
  outcome: ProviderOutcome,
  info?: Record<string, unknown>
) {
  const snapshot = recordPaymentLinkProviderOutcome(outcome);
  console.info(`[payment-link][provider-metric] ${ctx.requestId}`, {
    outcome,
    ...snapshot,
    durationMs: Date.now() - ctx.startedAt,
    ...info,
  });
}

async function waitForPaymentLink(orderId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < PAYMENT_LINK_WAIT_MS) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        paymentLinkUrl: true,
        inflywayOrderId: true,
      },
    });
    if (order?.paymentLinkUrl) {
      return order;
    }
    await sleep(PAYMENT_LINK_POLL_MS);
  }
  return null;
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  ensureInflywayAutoRefreshStarted();

  if (!isInvoiceMode) {
    logApiWarning(ctx, 400, { reason: "invoice_mode_disabled" });
    recordPaymentLinkMetric(ctx, "rejected", {
      reason: "invoice_mode_disabled",
    });
    return jsonError("Invoice mode disabled", 400, ctx);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    recordPaymentLinkMetric(ctx, "rejected", {
      reason: "invalid_json",
    });
    return jsonError("Invalid request body", 400, ctx);
  }

  if (!body?.items?.length) {
    logApiWarning(ctx, 400, { reason: "empty_bag" });
    recordPaymentLinkMetric(ctx, "rejected", {
      reason: "empty_bag",
    });
    return jsonError("Bag is empty", 400, ctx);
  }

  if (
    !body.address?.email ||
    !body.address?.fullName ||
    !body.address?.country
  ) {
    logApiWarning(ctx, 400, {
      reason: "missing_fields",
      email: maskEmail(body.address?.email),
    });
    recordPaymentLinkMetric(ctx, "rejected", {
      reason: "missing_fields",
    });
    return jsonError("Email, name, and country are required", 400, ctx);
  }

  const idempotencyKey = body.idempotencyKey?.trim() || null;
  const metricStartedAt = Date.now();
  let fallbackOrder:
    | {
        id: string;
        orderNumber: string;
        email: string;
      }
    | null = null;
  let fallbackEmailItems: RequestEmailItem[] = [];
  let createdNewOrder = false;

  try {
    // 幂等性检查（通过 idempotencyKey）
    const existingOrder = idempotencyKey
      ? await prisma.order.findUnique({
          where: { idempotencyKey },
        })
      : null;

    if (existingOrder?.paymentLinkUrl) {
      logInflywayTrace(ctx, "idempotency_hit", {
        orderNumber: existingOrder.orderNumber,
      });
      recordPaymentLinkMetric(ctx, "success", {
        orderNumber: existingOrder.orderNumber,
        cached: true,
        durationMs: Date.now() - metricStartedAt,
      });
      logApiSuccess(ctx, 200, {
        orderNumber: existingOrder.orderNumber,
        cached: true,
      });
      return jsonOk(
        {
          orderNumber: existingOrder.orderNumber,
          paymentLinkUrl: existingOrder.paymentLinkUrl,
          inflywayOrderId: existingOrder.inflywayOrderId,
          trackUrl: buildTrackUrlForOrder(request, existingOrder.orderNumber, existingOrder.email),
          checkoutProvider: CHECKOUT_PROVIDER_NAME,
          checkoutHost: resolveCheckoutHost(existingOrder.paymentLinkUrl),
          status: "success" as const,
        },
        ctx
      );
    }

    if (existingOrder?.status === OrderStatus.PROCESSING) {
      logInflywayTrace(ctx, "idempotency_wait_processing", {
        orderNumber: existingOrder.orderNumber,
      });
      const waited = await waitForPaymentLink(existingOrder.id);
      if (waited?.paymentLinkUrl) {
        recordPaymentLinkMetric(ctx, "success", {
          orderNumber: waited.orderNumber,
          cached: true,
          durationMs: Date.now() - metricStartedAt,
        });
        return jsonOk(
          {
            orderNumber: waited.orderNumber,
            paymentLinkUrl: waited.paymentLinkUrl,
            inflywayOrderId: waited.inflywayOrderId ?? undefined,
            trackUrl: buildTrackUrlForOrder(request, waited.orderNumber, existingOrder.email),
            checkoutProvider: CHECKOUT_PROVIDER_NAME,
            checkoutHost: resolveCheckoutHost(waited.paymentLinkUrl),
            status: "success" as const,
          },
          ctx
        );
      }
      recordPaymentLinkMetric(ctx, "pending", {
        orderNumber: existingOrder.orderNumber,
        durationMs: Date.now() - metricStartedAt,
      });
      return jsonOk(
        {
          orderNumber: existingOrder.orderNumber,
          trackUrl: buildTrackUrlForOrder(request, existingOrder.orderNumber, existingOrder.email),
          checkoutProvider: CHECKOUT_PROVIDER_NAME,
          status: "processing" as const,
        },
        ctx
      );
    }

    // 获取商品信息
    const uniqueProductIds = Array.from(
      new Set(body.items.map((item) => item.productId))
    );
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds } },
      select: checkoutProductSelect,
    });
    const discounts = await getActiveDiscounts();

    if (dbProducts.length !== uniqueProductIds.length) {
      logApiWarning(ctx, 400, {
        reason: "product_unavailable",
        count: dbProducts.length,
      });
      recordPaymentLinkMetric(ctx, "rejected", {
        reason: "product_unavailable",
        durationMs: Date.now() - metricStartedAt,
      });
      return jsonError("One or more products are unavailable", 400, ctx);
    }

    fallbackEmailItems = body.items.map((item) => {
      const product = dbProducts.find((p) => p.id === item.productId)!;
      const discountPercent = resolveDiscountPercent(
        product.id,
        product.categoryId,
        discounts
      );
      const unitPrice = applyDiscount(Number(product.price), discountPercent);
      const optionText = formatOptions(item.options);
      return {
        title: optionText ? `${product.titleEn} (${optionText})` : product.titleEn,
        qty: item.quantity || 1,
        price: unitPrice,
        currency: product.currency,
      };
    });

    // 计算价格
    let discountTotal = 0;
    const subtotal = body.items.reduce((sum, item) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) return sum;
      const discountPercent = resolveDiscountPercent(
        product.id,
        product.categoryId,
        discounts
      );
      const originalPrice = Number(product.price);
      const unitPrice = applyDiscount(originalPrice, discountPercent);
      if (discountPercent > 0) {
        discountTotal += (originalPrice - unitPrice) * (item.quantity || 1);
      }
      return sum + unitPrice * (item.quantity || 1);
    }, 0);

    const shippingTotal = body.shipping?.price ?? calculateShipping(subtotal);
    const total = Number((subtotal + shippingTotal).toFixed(2));

    let order = existingOrder;
    if (!order) {
      createdNewOrder = true;
      // 创建本地订单（先落库，避免 Inflyway 成功但本地失败）
      const orderNumber = generateRequestNumber();
      const addressJson = safeJson({
        fullName: body.address.fullName,
        email: body.address.email,
        phone: body.address.phone,
        country: body.address.country,
        address1: body.address.address1,
        address2: body.address.address2,
        city: body.address.city,
        state: body.address.state,
        postalCode: body.address.postalCode,
      });

      const createdOrder = await createOrder({
        email: body.address.email.toLowerCase(),
        mode: "request",
        orderNumber,
        status: OrderStatus.AWAITING_PAYMENT_LINK,
        subtotal,
        shippingTotal,
        taxTotal: 0,
        total,
        discountTotal,
        currency: "USD",
        paymentMethod: "invoice",
        source: body.source ?? "checkout",
        referralCode: body.referralCode ?? null,
        utm: body.utm ?? undefined,
        shippingAddress: addressJson,
        billingAddress: addressJson,
        idempotencyKey,
        items: body.items.map((item) => {
          const product = dbProducts.find((p) => p.id === item.productId)!;
          const discountPercent = resolveDiscountPercent(
            product.id,
            product.categoryId,
            discounts
          );
          const unitPrice = applyDiscount(Number(product.price), discountPercent);
          const optionText = formatOptions(item.options);
          return {
            productId: product.id,
            qty: item.quantity || 1,
            price: unitPrice,
            currency: product.currency,
            titleSnapshot: optionText
              ? `${product.titleEn} (${optionText})`
              : product.titleEn,
          };
        }),
        tracking: {
          statusHistory: [
            {
              timestamp: new Date().toISOString(),
              status: "Payment link pending",
              message: "Waiting for payment link generation.",
            },
          ],
        },
      });

      order = await prisma.order.update({
        where: { id: createdOrder.id },
        data: { status: OrderStatus.PROCESSING },
      });
      fallbackOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        email: order.email,
      };
      logInflywayTrace(ctx, "order_initialized", {
        orderNumber: order.orderNumber,
        total,
        items: body.items.length,
        idempotencyKey,
        email: maskEmail(order.email),
      });

      try {
        const trackUrl = buildTrackUrlForOrder(request, order.orderNumber, order.email);
        const emailItems = createdOrder.items.map((item) => ({
          title: item.titleSnapshot ?? "Item",
          qty: item.qty,
          price: Number(item.price),
          currency: item.currency,
        }));
        const emailTemplate = buildRequestReceivedEmail({
          orderNumber: order.orderNumber,
          email: order.email,
          items: emailItems,
          trackUrl,
        });
        await sendEmail({
          to: order.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
      } catch (emailError) {
        logApiWarning(ctx, 200, {
          reason: "request_received_email_failed",
          orderNumber: order.orderNumber,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    } else {
      fallbackOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        email: order.email,
      };
      const locked = await prisma.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: [OrderStatus.AWAITING_PAYMENT_LINK, OrderStatus.PENDING],
          },
        },
        data: { status: OrderStatus.PROCESSING },
      });

      if (locked.count === 0) {
        logInflywayTrace(ctx, "order_locked_by_other", {
          orderNumber: order.orderNumber,
        });
        const waited = await waitForPaymentLink(order.id);
        if (waited?.paymentLinkUrl) {
          recordPaymentLinkMetric(ctx, "success", {
            orderNumber: waited.orderNumber,
            cached: true,
            durationMs: Date.now() - metricStartedAt,
          });
          return jsonOk(
            {
              orderNumber: waited.orderNumber,
              paymentLinkUrl: waited.paymentLinkUrl,
              inflywayOrderId: waited.inflywayOrderId ?? undefined,
              trackUrl: buildTrackUrlForOrder(request, waited.orderNumber, order.email),
              checkoutProvider: CHECKOUT_PROVIDER_NAME,
              checkoutHost: resolveCheckoutHost(waited.paymentLinkUrl),
              status: "success" as const,
            },
            ctx
          );
        }
        recordPaymentLinkMetric(ctx, "pending", {
          orderNumber: order.orderNumber,
          durationMs: Date.now() - metricStartedAt,
        });
        return jsonOk(
          {
            orderNumber: order.orderNumber,
            trackUrl: buildTrackUrlForOrder(request, order.orderNumber, order.email),
            checkoutProvider: CHECKOUT_PROVIDER_NAME,
            status: "processing" as const,
          },
          ctx
        );
      }
    }

    if (!order) {
      throw new Error("Order not initialized");
    }
    if (!fallbackOrder) {
      fallbackOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        email: order.email,
      };
    }

    let tokenInfo = await resolveInflywayToken();
    if (!tokenInfo.token) {
      await triggerInflywayHealthCheck("checkout_preflight");
      tokenInfo = await resolveInflywayToken();
    }

    if (!tokenInfo.token) {
      const pendingOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.AWAITING_PAYMENT_LINK },
      });
      fallbackOrder = {
        id: pendingOrder.id,
        orderNumber: pendingOrder.orderNumber,
        email: pendingOrder.email,
      };
      const trackUrl = buildTrackUrlForOrder(
        request,
        pendingOrder.orderNumber,
        pendingOrder.email
      );
      logApiWarning(ctx, 200, {
        reason: "inflyway_token_missing_fallback",
        tokenSource: tokenInfo.source,
        orderNumber: pendingOrder.orderNumber,
      });
      recordPaymentLinkMetric(ctx, "pending", {
        reason: "inflyway_token_missing_fallback",
        orderNumber: pendingOrder.orderNumber,
        durationMs: Date.now() - metricStartedAt,
      });
      if (createdNewOrder) {
        await sendRequestReceivedEmailSafe({
          orderNumber: pendingOrder.orderNumber,
          email: pendingOrder.email,
          trackUrl,
          items: fallbackEmailItems,
        });
      }
      return jsonOk(
        {
          orderNumber: pendingOrder.orderNumber,
          trackUrl,
          checkoutProvider: "Concierge invoice",
          status: "processing" as const,
          message: "Your request was received. We will share the payment link shortly.",
        },
        ctx
      );
    }

    const noteItems = body.items.map((item, index) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      const title = buildProviderSafeNoteItemTitle(
        (product as CheckoutDbProduct | undefined) ?? undefined,
        item.options,
        index
      );
      return { title, quantity: item.quantity || 1 };
    });
    const orderNote = buildInflywayOrderNote({
      orderNumber: order.orderNumber,
      email: body.address.email,
      name: body.address.fullName,
      phone: body.address.phone,
      items: noteItems,
      total,
      currency: "USD",
      address: body.address,
    });

    const dynamicProductImageUrl = resolveDynamicProductCompliantImage(
      body.items,
      dbProducts as unknown as CheckoutDbProduct[]
    );
    const dominantGroup = resolveDominantProductGroup(
      body.items,
      dbProducts as unknown as CheckoutDbProduct[]
    );
    const fallbackTemplateSku = resolveTemplateSkuForGroup(dominantGroup);
    const mirrorCategoryTitle = providerSafeMirrorCategoryTitle(dominantGroup);
    const mirrorProductTitle = `UOOTD Order #${order.orderNumber} - ${mirrorCategoryTitle}`;
    const mirrorProductDescription = `Secure checkout item for order ${order.orderNumber}. Category: ${mirrorCategoryTitle}.`;

    // 调用 Inflyway API 创建订单
    let inflywayResult;
    if (USE_DYNAMIC_PRODUCT) {
      // 动态商品模式：先创建商品（标题=订单号，价格=订单金额），再创建订单
      inflywayResult = await createInflywayOrderWithProduct({
        amount: total,
        currency: "USD",
        traceId: ctx.requestId,
        orderNote,
        productTitle: mirrorProductTitle,
        productDescription: mirrorProductDescription,
        productImageUrl: dynamicProductImageUrl,
        fallbackTemplateSku,
        shippingInfo: {
          fullName: body.address.fullName,
          email: body.address.email,
          phone: body.address.phone,
          country: body.address.country,
          state: body.address.state,
          city: body.address.city,
          postalCode: body.address.postalCode,
          address1: body.address.address1,
          address2: body.address.address2,
        },
      });
    } else {
      // 默认模式：使用通用商品
      inflywayResult = await createInflywayOrder({
        amount: total,
        currency: "USD",
        traceId: ctx.requestId,
        orderNote,
        shippingInfo: {
          fullName: body.address.fullName,
          email: body.address.email,
          phone: body.address.phone,
          country: body.address.country,
          state: body.address.state,
          city: body.address.city,
          postalCode: body.address.postalCode,
          address1: body.address.address1,
          address2: body.address.address2,
        },
      });
    }

    if (!inflywayResult.success || !inflywayResult.orderUrl) {
      recordProviderMetric(ctx, "failure", {
        reason: inflywayResult.error || "inflyway_failed",
        inflywayOrderId: inflywayResult.orderId,
      });
      logApiError(ctx, 500, new Error(inflywayResult.error || "Inflyway failed"), {
        email: maskEmail(body.address.email),
        orderNumber: order?.orderNumber,
        inflywayOrderId: inflywayResult.orderId,
        hasPaymentLink: Boolean(inflywayResult.orderUrl),
      });
      recordPaymentLinkMetric(ctx, "failure", {
        reason: "inflyway_failed",
        orderNumber: order?.orderNumber,
        inflywayOrderId: inflywayResult.orderId,
        durationMs: Date.now() - metricStartedAt,
      });
      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.AWAITING_PAYMENT_LINK },
        });
      }
      return jsonError(
        inflywayResult.error || "Failed to create payment link",
        500,
        ctx
      );
    }

    // 更新本地订单支付链接
    recordProviderMetric(ctx, "success", {
      inflywayOrderId: inflywayResult.orderId,
    });
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentLinkUrl: inflywayResult.orderUrl,
        inflywayOrderId: inflywayResult.orderId ?? order.inflywayOrderId,
        status: OrderStatus.PENDING,
      },
    });

    logApiSuccess(ctx, 200, {
      orderNumber: updatedOrder.orderNumber,
      email: maskEmail(updatedOrder.email),
      inflywayOrderId: inflywayResult.orderId,
    });
    recordPaymentLinkMetric(ctx, "success", {
      orderNumber: updatedOrder.orderNumber,
      inflywayOrderId: inflywayResult.orderId,
      durationMs: Date.now() - metricStartedAt,
    });
    try {
      const trackUrl = buildTrackUrlForOrder(request, updatedOrder.orderNumber, updatedOrder.email);
      const emailTemplate = buildPaymentLinkEmail({
        orderNumber: updatedOrder.orderNumber,
        paymentUrl: inflywayResult.orderUrl,
        trackUrl,
      });
      await sendEmail({
        to: updatedOrder.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (emailError) {
      logApiWarning(ctx, 200, {
        reason: "payment_link_email_failed",
        orderNumber: updatedOrder.orderNumber,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    }

    return jsonOk(
      {
        orderNumber: updatedOrder.orderNumber,
        paymentLinkUrl: inflywayResult.orderUrl,
        inflywayOrderId: inflywayResult.orderId,
        trackUrl: buildTrackUrlForOrder(request, updatedOrder.orderNumber, updatedOrder.email),
        checkoutProvider: CHECKOUT_PROVIDER_NAME,
        checkoutHost: resolveCheckoutHost(inflywayResult.orderUrl),
        status: "success" as const,
      },
      ctx
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to create payment link";
    logApiError(ctx, 500, error, {
      email: maskEmail(body.address?.email),
      items: body.items?.length ?? 0,
      message,
    });
    recordPaymentLinkMetric(ctx, "failure", {
      reason: "unexpected_error",
      durationMs: Date.now() - metricStartedAt,
    });
    if (
      message.includes("No available Inflyway token") ||
      message.includes("Inflyway token missing")
    ) {
      if (fallbackOrder) {
        const pendingOrder = await prisma.order.update({
          where: { id: fallbackOrder.id },
          data: { status: OrderStatus.AWAITING_PAYMENT_LINK },
        });
        const trackUrl = buildTrackUrlForOrder(
          request,
          pendingOrder.orderNumber,
          pendingOrder.email
        );
        recordPaymentLinkMetric(ctx, "pending", {
          reason: "inflyway_token_missing_catch_fallback",
          orderNumber: pendingOrder.orderNumber,
          durationMs: Date.now() - metricStartedAt,
        });
        if (createdNewOrder) {
          await sendRequestReceivedEmailSafe({
            orderNumber: pendingOrder.orderNumber,
            email: pendingOrder.email,
            trackUrl,
            items: fallbackEmailItems,
          });
        }
        return jsonOk(
          {
            orderNumber: pendingOrder.orderNumber,
            trackUrl,
            checkoutProvider: "Concierge invoice",
            status: "processing" as const,
            message: "Your request was received. We will share the payment link shortly.",
          },
          ctx
        );
      }
    }
    return jsonError(message, 500, ctx);
  }
}
