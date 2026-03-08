import { resolveCountryCode } from "@/lib/utils/countries";
import { normalizeDisplayLanguage, type DisplayLanguage } from "@/lib/utils/display-preferences";

export type CheckoutTrustCopy = {
  title: string;
  intro: string;
  consistencyHint: string;
  paymentProviderTitle: string;
  paymentProviderBody: string;
  orderStatusTitle: string;
  orderStatusBody: string;
  statusButton: string;
};

const CHECKOUT_TRUST_COPY: Record<DisplayLanguage, CheckoutTrustCopy> = {
  en: {
    title: "Review delivery information",
    intro:
      "After confirmation, we create your secure payment link and redirect you directly to the hosted checkout with a 3-second countdown.",
    consistencyHint:
      "The hosted page shows your UOOTD order reference and the exact same amount as your order.",
    paymentProviderTitle: "Payment provider",
    paymentProviderBody: "Checkout is hosted by our official partner (Inflyway).",
    orderStatusTitle: "Order status page",
    orderStatusBody: "Keep this page bookmarked. You can always reopen your order status here.",
    statusButton: "Open order status page",
  },
  zh: {
    title: "确认收货信息",
    intro: "确认后我们会生成安全支付链接，并在 3 秒倒计时后跳转到托管支付页。",
    consistencyHint: "托管支付页会显示 UOOTD 订单号，金额与您当前订单完全一致。",
    paymentProviderTitle: "支付通道",
    paymentProviderBody: "支付由我们的官方合作方（Inflyway）托管完成。",
    orderStatusTitle: "站内订单状态页",
    orderStatusBody: "建议收藏本页，后续可随时回到站内查看订单状态。",
    statusButton: "打开订单状态页",
  },
  pt: {
    title: "Revise os dados de entrega",
    intro:
      "Após confirmar, criamos seu link de pagamento seguro e redirecionamos para o checkout hospedado em 3 segundos.",
    consistencyHint: "A página hospedada mostra o número UOOTD e o mesmo valor do seu pedido.",
    paymentProviderTitle: "Provedor de pagamento",
    paymentProviderBody: "O pagamento é hospedado pelo nosso parceiro oficial (Inflyway).",
    orderStatusTitle: "Página de status do pedido",
    orderStatusBody: "Salve esta página para acompanhar seu pedido a qualquer momento.",
    statusButton: "Abrir status do pedido",
  },
};

export function getCheckoutTrustCopy(localeOrLanguage?: string | null) {
  const language = normalizeDisplayLanguage(localeOrLanguage) || "en";
  return CHECKOUT_TRUST_COPY[language];
}

export type ShippingDisplayProfile = {
  carrier: string;
  eta: string;
  note: string;
};

const DEFAULT_SHIPPING_PROFILE: ShippingDisplayProfile = {
  carrier: "UPS / DHL",
  eta: "5-9 business days",
  note: "Duties/taxes may apply depending on destination policy.",
};

const SHIPPING_PROFILE_BY_COUNTRY: Record<string, ShippingDisplayProfile> = {
  US: {
    carrier: "UPS Express",
    eta: "4-8 business days",
    note: "Import taxes are determined by US customs at delivery.",
  },
  GB: {
    carrier: "UPS UK",
    eta: "5-9 business days",
    note: "VAT/import fees may apply based on parcel value.",
  },
  CA: {
    carrier: "UPS Canada",
    eta: "5-10 business days",
    note: "Duties and GST/HST are determined by Canadian customs.",
  },
  AU: {
    carrier: "UPS Australia",
    eta: "6-10 business days",
    note: "GST/import fees depend on shipment declaration value.",
  },
  BR: {
    carrier: "UPS / Correios handoff",
    eta: "7-14 business days",
    note: "Import taxes are assessed by local customs.",
  },
};

export function getShippingDisplayProfile(countryCode?: string | null): ShippingDisplayProfile {
  const code = resolveCountryCode(countryCode || "US");
  return SHIPPING_PROFILE_BY_COUNTRY[code] ?? DEFAULT_SHIPPING_PROFILE;
}
