export type AdminEmailTemplateId =
  | "order-confirmed"
  | "shipping-update"
  | "official-checkout"
  | "authenticity-care";

export type AdminEmailTemplateVariables = {
  customerName: string;
  orderNumber: string;
  trackingUrl: string;
  paymentUrl: string;
  estimatedDelivery: string;
  supportEmail: string;
  whatsappNumber: string;
  siteUrl: string;
  couponCode: string;
};

type AdminTemplateMeta = {
  id: AdminEmailTemplateId;
  label: string;
  description: string;
};

export const ADMIN_EMAIL_TEMPLATES: AdminTemplateMeta[] = [
  {
    id: "order-confirmed",
    label: "订单确认",
    description: "付款确认 + 信任背书 + 下一步指引。",
  },
  {
    id: "shipping-update",
    label: "发货更新",
    description: "物流链接 + 运输时效 + 客服渠道。",
  },
  {
    id: "official-checkout",
    label: "官方收款页",
    description: "说明安全官方结账及有效付款链接。",
  },
  {
    id: "authenticity-care",
    label: "正品与售后",
    description: "正品承诺 + 售后支持说明。",
  },
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fallback(value: string, defaultValue: string) {
  return value.trim() || defaultValue;
}

function renderFrame(title: string, lead: string, bodyHtml: string, cta?: { label: string; href: string }) {
  const ctaHtml = cta
    ? `<a href="${escapeHtml(
        cta.href,
      )}" style="display:inline-block;margin-top:14px;padding:12px 20px;border-radius:9999px;background:#111;color:#fff;text-decoration:none;font-weight:600;">${escapeHtml(
        cta.label,
      )}</a>`
    : "";

  return `
<div style="background:#f5f2eb;padding:28px 14px;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e9e2d7;border-radius:18px;padding:26px 24px;font-family:Arial,Helvetica,sans-serif;color:#201a14;">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8e8478;">UOOTD</p>
    <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4c4339;">${escapeHtml(lead)}</p>
    ${bodyHtml}
    ${ctaHtml}
  </div>
</div>
`;
}

function trustCard(label: string, value: string) {
  return `<div style="padding:10px 12px;border:1px solid #eee5d8;border-radius:12px;background:#fbfaf7;">
    <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#8e8478;">${escapeHtml(
      label,
    )}</p>
    <p style="margin:0;font-size:14px;color:#2a241d;">${escapeHtml(value)}</p>
  </div>`;
}

export function getDefaultAdminTemplateVariables(): AdminEmailTemplateVariables {
  return {
    customerName: "客户",
    orderNumber: "UOOTD-RQ-000000",
    trackingUrl: "",
    paymentUrl: "",
    estimatedDelivery: "5-9 个工作日",
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@luxuryootd.com",
    whatsappNumber: process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP || "",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://luxuryootd.com",
    couponCode: "",
  };
}

export function buildAdminEmailTemplate(
  templateId: AdminEmailTemplateId,
  input: AdminEmailTemplateVariables,
) {
  const customerName = fallback(input.customerName, "客户");
  const orderNumber = fallback(input.orderNumber, "UOOTD-RQ-000000");
  const supportEmail = fallback(input.supportEmail, "support@luxuryootd.com");
  const whatsapp = input.whatsappNumber.trim();
  const trackingUrl = input.trackingUrl.trim();
  const paymentUrl = input.paymentUrl.trim();
  const siteUrl = fallback(input.siteUrl, "https://luxuryootd.com");
  const eta = fallback(input.estimatedDelivery, "5-9 个工作日");
  const couponCode = input.couponCode.trim();

  const supportLine = whatsapp
    ? `Email: ${supportEmail} | WhatsApp: ${whatsapp}`
    : `Email: ${supportEmail}`;

  if (templateId === "order-confirmed") {
    const subject = `Order confirmed: ${orderNumber}`;
    const html = renderFrame(
      "Your order is confirmed",
      `Hi ${customerName}, your payment is confirmed. Our team is preparing your order now.`,
      `
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px;">
  ${trustCard("Order Number", orderNumber)}
  ${trustCard("Estimated Delivery", eta)}
  ${trustCard("Carrier", "Global UPS direct")}
  ${trustCard("Support", supportLine)}
</div>
<p style="margin:0;color:#4c4339;line-height:1.7;">Every order is manually quality-checked before dispatch. You can reply to this email any time for priority support.</p>
`,
      { label: "View your order", href: siteUrl },
    );
    const text = [
      `Hi ${customerName},`,
      `Your order is confirmed: ${orderNumber}.`,
      `Estimated delivery: ${eta}.`,
      "Carrier: Global UPS direct.",
      `Support: ${supportLine}.`,
      `Order page: ${siteUrl}`,
    ].join("\n");
    return { subject, html, text };
  }

  if (templateId === "shipping-update") {
    const subject = `Shipping update: ${orderNumber}`;
    const html = renderFrame(
      "Your package is on the way",
      `Hi ${customerName}, your order ${orderNumber} has been shipped.`,
      `
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px;">
  ${trustCard("Order Number", orderNumber)}
  ${trustCard("Estimated Delivery", eta)}
  ${trustCard("Carrier", "UPS")}
  ${trustCard("Support", supportLine)}
</div>
<p style="margin:0 0 10px;color:#4c4339;line-height:1.7;">You can track your parcel in real time using the tracking link.</p>
`,
      trackingUrl ? { label: "Track shipment", href: trackingUrl } : { label: "Open store", href: siteUrl },
    );
    const text = [
      `Hi ${customerName},`,
      `Your order ${orderNumber} has shipped.`,
      `Estimated delivery: ${eta}.`,
      trackingUrl ? `Tracking: ${trackingUrl}` : "",
      `Support: ${supportLine}.`,
    ]
      .filter(Boolean)
      .join("\n");
    return { subject, html, text };
  }

  if (templateId === "official-checkout") {
    const subject = `Secure payment link for ${orderNumber}`;
    const html = renderFrame(
      "Official checkout link",
      `Hi ${customerName}, for payment security, checkout is completed on our official partner page.`,
      `
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px;">
  ${trustCard("Order Number", orderNumber)}
  ${trustCard("Payment Security", "Official encrypted checkout")}
  ${trustCard("Accepted Cards", "Visa, Mastercard, Amex, Apple Pay")}
  ${trustCard("Support", supportLine)}
</div>
<p style="margin:0 0 10px;color:#4c4339;line-height:1.7;">Your link is unique and tied to this order only. If the page fails to open, contact support and we will help immediately.</p>
`,
      paymentUrl ? { label: "Open secure checkout", href: paymentUrl } : { label: "Open store", href: siteUrl },
    );
    const text = [
      `Hi ${customerName},`,
      "Checkout is completed on our official encrypted partner page.",
      `Order number: ${orderNumber}.`,
      paymentUrl ? `Payment link: ${paymentUrl}` : "",
      `Support: ${supportLine}.`,
    ]
      .filter(Boolean)
      .join("\n");
    return { subject, html, text };
  }

  const subject = `Authenticity & after-sales support for ${orderNumber}`;
  const html = renderFrame(
    "Authenticity and care commitment",
    `Hi ${customerName}, thank you for choosing UOOTD. We stand behind your order with clear after-sales support.`,
    `
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px;">
  ${trustCard("Order Number", orderNumber)}
  ${trustCard("Authentication", "Manual quality inspection")}
  ${trustCard("Shipping", "Global UPS direct, 5-9 days")}
  ${trustCard("Support", supportLine)}
</div>
<ul style="margin:0 0 12px;padding-left:18px;color:#4c4339;line-height:1.7;">
  <li>Order confirmation and status updates by email</li>
  <li>Dedicated support team for shipping and payment issues</li>
  <li>Transparent timeline and proactive issue resolution</li>
</ul>
${couponCode ? `<p style="margin:0;color:#4c4339;">Courtesy code for your next order: <strong>${escapeHtml(couponCode)}</strong></p>` : ""}
`,
    { label: "Visit UOOTD", href: siteUrl },
  );
  const text = [
    `Hi ${customerName},`,
    "We stand behind your order with authenticity checks and after-sales support.",
    `Order number: ${orderNumber}.`,
    "Shipping: Global UPS direct, 5-9 days.",
    couponCode ? `Courtesy code: ${couponCode}` : "",
    `Support: ${supportLine}.`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}
