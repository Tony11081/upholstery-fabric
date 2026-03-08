import type { Prisma } from "@prisma/client";

export function decimalToNumber(value: Prisma.Decimal | number | bigint) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return Number(value);
}
