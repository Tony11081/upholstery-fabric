export const FREE_SHIPPING_THRESHOLD = 120;
export const STANDARD_SHIPPING_FEE = 25;

export function calculateShipping(subtotal: number) {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return subtotal < FREE_SHIPPING_THRESHOLD ? STANDARD_SHIPPING_FEE : 0;
}
