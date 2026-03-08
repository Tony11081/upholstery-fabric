import type { Prisma } from "@prisma/client";
import { decimalToNumber } from "@/lib/utils/money";

type PriceInput = {
  price: Prisma.Decimal | number;
  discountedPrice?: number | null;
};

export function getProductPrice(product: PriceInput) {
  return product.discountedPrice ?? decimalToNumber(product.price);
}

export function getProductBasePrice(product: PriceInput) {
  return decimalToNumber(product.price);
}
