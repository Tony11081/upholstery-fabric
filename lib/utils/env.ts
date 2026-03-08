export const isProd = process.env.NODE_ENV === "production";
export const allowMockDataFallback = process.env.ALLOW_MOCK_DATA !== "false";

export type PaymentMode = "invoice" | "stripe";

const parseBooleanEnv = (value?: string | null) => {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
};

const rawPaymentMode = process.env.PAYMENT_MODE ?? process.env.NEXT_PUBLIC_PAYMENT_MODE ?? "invoice";
export const paymentMode: PaymentMode = rawPaymentMode === "stripe" ? "stripe" : "invoice";
export const isInvoiceMode = paymentMode !== "stripe";

const rawExtensionOrderSync = parseBooleanEnv(
  process.env.ENABLE_EXTENSION_ORDER_SYNC ??
    process.env.NEXT_PUBLIC_ENABLE_EXTENSION_ORDER_SYNC
);
export const isExtensionOrderSyncEnabled = rawExtensionOrderSync ?? !isProd;
