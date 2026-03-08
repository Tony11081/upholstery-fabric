import type { Prisma } from "@prisma/client";
import { formatPrice } from "@/lib/utils/format";
import { BRAND_NAME } from "@/lib/utils/site";

type EmailItem = {
  title: string;
  qty: number;
  price: number;
  currency: string;
};

type RequestReceivedInput = {
  orderNumber: string;
  email: string;
  items: EmailItem[];
  trackUrl: string;
};

type PaymentLinkInput = {
  orderNumber: string;
  paymentUrl: string;
  trackUrl?: string;
};

type OrderStatusEmailInput = {
  orderNumber: string;
  status: "CONFIRMED" | "SHIPPED" | "DELIVERED";
  items?: EmailItem[];
  trackUrl?: string;
  trackingNumber?: string | null;
  carrier?: string | null;
};

type BackInStockInput = {
  productTitle: string;
  productUrl: string;
};

type CouponEmailInput = {
  code: string;
  description?: string;
  expiresAt?: string | null;
  redeemUrl?: string;
};

type ConsultationInternalInput = {
  requestId: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  channel?: string | null;
  preferredAt?: string | null;
  notes?: string | null;
  context?: Prisma.InputJsonValue | null;
};

type ConsultationConfirmationInput = {
  name?: string | null;
  email: string;
  channel?: string | null;
  preferredAt?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderItems(items: EmailItem[]) {
  if (!items.length) {
    return "<p>No items listed.</p>";
  }
  const rows = items
    .map((item) => {
      const title = escapeHtml(item.title || "Item");
      const price = formatPrice(item.price, item.currency);
      return `<li style="margin:0 0 6px 0;">${item.qty} x ${title} <span style="color:#6b6258;">(${price})</span></li>`;
    })
    .join("");
  return `<ul style="margin:0;padding-left:18px;">${rows}</ul>`;
}

function renderLayout(title: string, body: string, cta?: { label: string; href: string }) {
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@moppetbrandname.shop";
  const ctaHtml = cta
    ? `<p style="margin:24px 0 0;"><a href="${cta.href}" style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;display:inline-block;">${cta.label}</a></p>`
    : "";

  return `
    <div style="background:#f7f3ee;padding:28px 16px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;padding:24px 24px 20px;font-family:Arial,Helvetica,sans-serif;color:#1f1b16;">
        <p style="letter-spacing:0.2em;text-transform:uppercase;font-size:10px;color:#9c9185;margin:0 0 8px;">${BRAND_NAME}</p>
        <h1 style="font-size:22px;margin:0 0 12px;font-weight:600;">${title}</h1>
        ${body}
        ${ctaHtml}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="font-size:12px;color:#6b6258;margin:0;">
          Need help? Reply to this email or contact <a href="mailto:${supportEmail}" style="color:#6b6258;">${supportEmail}</a>.
        </p>
      </div>
    </div>
  `;
}

export function buildRequestReceivedEmail(input: RequestReceivedInput) {
  const subject = `We received your request ${input.orderNumber}`;
  const body = `
    <p style="margin:0 0 12px;">Thank you. We have received your purchase request.</p>
    <p style="margin:0 0 6px;"><strong>Reference:</strong> ${escapeHtml(input.orderNumber)}</p>
    <p style="margin:0 0 12px;"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p style="margin:0 0 8px;"><strong>Items:</strong></p>
    ${renderItems(input.items)}
    <p style="margin:16px 0 0;">We will send a secure payment link shortly.</p>
  `;
  const html = renderLayout("Request received", body, {
    label: "Track your request",
    href: input.trackUrl,
  });
  const textLines = [
    "We received your purchase request.",
    `Reference: ${input.orderNumber}`,
    `Email: ${input.email}`,
    "Items:",
    ...input.items.map((item) => `- ${item.qty} x ${item.title} (${formatPrice(item.price, item.currency)})`),
    `Track: ${input.trackUrl}`,
  ];
  return { subject, html, text: textLines.join("\n") };
}

export function buildPaymentLinkEmail(input: PaymentLinkInput) {
  const subject = "Your secure payment link";
  const trackHtml = input.trackUrl
    ? `<p style="margin:12px 0 0;"><a href="${input.trackUrl}" style="color:#6b6258;">Track your request</a></p>`
    : "";
  const body = `
    <p style="margin:0 0 12px;">Your payment link is ready for request ${escapeHtml(input.orderNumber)}.</p>
    <p style="margin:0 0 12px;">Use the button below to complete payment.</p>
    <p style="margin:16px 0 0;color:#6b6258;font-size:13px;">
      If the button does not work, copy and paste this URL:<br/>
      <a href="${input.paymentUrl}" style="color:#6b6258;">${input.paymentUrl}</a>
    </p>
    ${trackHtml}
  `;
  const html = renderLayout("Payment link ready", body, {
    label: "Open payment link",
    href: input.paymentUrl,
  });
  const textLines = [
    `Your payment link is ready for request ${input.orderNumber}.`,
    `Payment link: ${input.paymentUrl}`,
  ];
  if (input.trackUrl) {
    textLines.push(`Track: ${input.trackUrl}`);
  }
  return { subject, html, text: textLines.join("\n") };
}

export function buildOrderStatusEmail(input: OrderStatusEmailInput) {
  const statusCopy = {
    CONFIRMED: {
      title: "Order confirmed",
      subject: `Order confirmed ${input.orderNumber}`,
      message: "We have received your payment and will begin preparing your order.",
    },
    SHIPPED: {
      title: "Order shipped",
      subject: `Your order has shipped ${input.orderNumber}`,
      message: "Your order is on the way.",
    },
    DELIVERED: {
      title: "Order delivered",
      subject: `Order delivered ${input.orderNumber}`,
      message: "Your order has been delivered. We hope you love it.",
    },
  } as const;

  const copy = statusCopy[input.status];
  const trackingDetails = input.trackingNumber
    ? `<p style="margin:8px 0 0;"><strong>Tracking:</strong> ${escapeHtml(
        input.trackingNumber,
      )}${input.carrier ? ` (${escapeHtml(input.carrier)})` : ""}</p>`
    : "";
  const itemsHtml = input.items?.length
    ? `<p style="margin:16px 0 8px;"><strong>Items:</strong></p>${renderItems(input.items)}`
    : "";

  const body = `
    <p style="margin:0 0 12px;"><strong>Order:</strong> ${escapeHtml(input.orderNumber)}</p>
    <p style="margin:0 0 12px;">${copy.message}</p>
    ${trackingDetails}
    ${itemsHtml}
  `;

  const html = renderLayout(copy.title, body, input.trackUrl ? { label: "Track your order", href: input.trackUrl } : undefined);
  const textLines = [
    `${copy.title} - ${copy.message}`,
    `Order: ${input.orderNumber}`,
    input.trackingNumber ? `Tracking: ${input.trackingNumber}${input.carrier ? ` (${input.carrier})` : ""}` : "",
    input.items?.length
      ? ["Items:", ...input.items.map((item) => `- ${item.qty} x ${item.title} (${formatPrice(item.price, item.currency)})`)].join("\n")
      : "",
    input.trackUrl ? `Track: ${input.trackUrl}` : "",
  ].filter(Boolean);

  return { subject: copy.subject, html, text: textLines.join("\n") };
}

export function buildBackInStockEmail(input: BackInStockInput) {
  const subject = `Back in stock: ${input.productTitle}`;
  const body = `
    <p style="margin:0 0 12px;">Good news - the item you requested is available again.</p>
    <p style="margin:0 0 12px;"><strong>${escapeHtml(input.productTitle)}</strong></p>
    <p style="margin:0 0 12px;">Tap below to view the product and place your order.</p>
  `;
  const html = renderLayout("Back in stock", body, {
    label: "View product",
    href: input.productUrl,
  });
  const textLines = [
    "Back in stock",
    input.productTitle,
    `View: ${input.productUrl}`,
  ];
  return { subject, html, text: textLines.join("\n") };
}

export function buildCouponEmail(input: CouponEmailInput) {
  const subject = "Your exclusive offer";
  const body = `
    <p style="margin:0 0 12px;">A private offer has been reserved for you.</p>
    <p style="margin:0 0 12px;"><strong>Code:</strong> ${escapeHtml(input.code)}</p>
    ${input.description ? `<p style="margin:0 0 12px;">${escapeHtml(input.description)}</p>` : ""}
    ${input.expiresAt ? `<p style="margin:0 0 12px;"><strong>Expires:</strong> ${escapeHtml(input.expiresAt)}</p>` : ""}
  `;
  const html = renderLayout("Exclusive offer", body, input.redeemUrl ? { label: "Shop now", href: input.redeemUrl } : undefined);
  const textLines = [
    "Your exclusive offer",
    `Code: ${input.code}`,
    input.description ?? "",
    input.expiresAt ? `Expires: ${input.expiresAt}` : "",
    input.redeemUrl ? `Shop: ${input.redeemUrl}` : "",
  ].filter(Boolean);
  return { subject, html, text: textLines.join("\n") };
}

export function buildConsultationInternalEmail(input: ConsultationInternalInput) {
  const subject = `Concierge request ${input.requestId}`;
  const body = `
    <p style="margin:0 0 12px;">A new concierge consultation request has been submitted.</p>
    <p style="margin:0 0 6px;"><strong>Request ID:</strong> ${escapeHtml(input.requestId)}</p>
    <p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(input.name ?? "Not provided")}</p>
    <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p style="margin:0 0 6px;"><strong>Phone:</strong> ${escapeHtml(input.phone ?? "Not provided")}</p>
    <p style="margin:0 0 6px;"><strong>Channel:</strong> ${escapeHtml(input.channel ?? "Not specified")}</p>
    <p style="margin:0 0 12px;"><strong>Preferred time:</strong> ${escapeHtml(input.preferredAt ?? "Not specified")}</p>
    ${input.notes ? `<p style="margin:0 0 12px;"><strong>Notes:</strong> ${escapeHtml(input.notes)}</p>` : ""}
    ${
      input.context
        ? `<p style="margin:0 0 12px;"><strong>Context:</strong> ${escapeHtml(JSON.stringify(input.context))}</p>`
        : ""
    }
  `;
  const html = renderLayout("Concierge request", body);
  const textLines = [
    "New concierge consultation request",
    `Request ID: ${input.requestId}`,
    `Name: ${input.name ?? "Not provided"}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone ?? "Not provided"}`,
    `Channel: ${input.channel ?? "Not specified"}`,
    `Preferred time: ${input.preferredAt ?? "Not specified"}`,
    input.notes ? `Notes: ${input.notes}` : "",
    input.context ? `Context: ${JSON.stringify(input.context)}` : "",
  ].filter(Boolean);
  return { subject, html, text: textLines.join("\n") };
}

export function buildConsultationConfirmationEmail(input: ConsultationConfirmationInput) {
  const subject = "We received your concierge request";
  const greeting = input.name ? `Hello ${escapeHtml(input.name)},` : "Hello,";
  const body = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">Thank you for booking a private consultation with our team.</p>
    <p style="margin:0 0 6px;"><strong>Preferred channel:</strong> ${escapeHtml(input.channel ?? "Not specified")}</p>
    <p style="margin:0 0 12px;"><strong>Preferred time:</strong> ${escapeHtml(input.preferredAt ?? "Flexible")}</p>
    <p style="margin:0 0 12px;">We will reach out within one business day to confirm details.</p>
  `;
  const html = renderLayout("Concierge request received", body);
  const textLines = [
    input.name ? `Hello ${input.name},` : "Hello,",
    "Thank you for booking a private consultation with our team.",
    `Preferred channel: ${input.channel ?? "Not specified"}`,
    `Preferred time: ${input.preferredAt ?? "Flexible"}`,
    "We will reach out within one business day to confirm details.",
  ];
  return { subject, html, text: textLines.join("\n") };
}
