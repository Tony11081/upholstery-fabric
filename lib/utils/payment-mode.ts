export const paymentModeClient =
  (process.env.NEXT_PUBLIC_PAYMENT_MODE as "invoice" | "stripe" | undefined) ?? "invoice";

export const isInvoiceModeClient = paymentModeClient !== "stripe";
