import { calculateShipping } from "@/lib/utils/shipping";

export type RegionConfig = {
  code: string;
  label: string;
  vatRate: number;
  dutyRate: number;
  shippingBase: number;
  shippingPerItem: number;
  note?: string;
};

export const REGION_CONFIGS: RegionConfig[] = [
  { code: "US", label: "United States", vatRate: 0, dutyRate: 0, shippingBase: 25, shippingPerItem: 5 },
  { code: "UK", label: "United Kingdom", vatRate: 0, dutyRate: 0, shippingBase: 30, shippingPerItem: 6 },
  { code: "EU", label: "European Union", vatRate: 0, dutyRate: 0, shippingBase: 30, shippingPerItem: 6 },
  { code: "CA", label: "Canada", vatRate: 0, dutyRate: 0, shippingBase: 28, shippingPerItem: 6 },
  { code: "AU", label: "Australia", vatRate: 0, dutyRate: 0, shippingBase: 28, shippingPerItem: 6 },
  { code: "JP", label: "Japan", vatRate: 0, dutyRate: 0, shippingBase: 25, shippingPerItem: 5 },
  { code: "CN", label: "China", vatRate: 0, dutyRate: 0, shippingBase: 25, shippingPerItem: 5 },
  { code: "INTL", label: "International", vatRate: 0, dutyRate: 0, shippingBase: 35, shippingPerItem: 8 },
];

export function guessRegionCode() {
  if (typeof navigator === "undefined") return "US";
  const language = navigator.language.toLowerCase();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  if (language.startsWith("en-gb") || timezone.includes("London")) return "UK";
  if (language.startsWith("en-ca") || timezone.includes("Toronto")) return "CA";
  if (language.startsWith("en-au") || timezone.includes("Sydney")) return "AU";
  if (language.startsWith("ja") || timezone.includes("Tokyo")) return "JP";
  if (language.startsWith("zh") || timezone.includes("Shanghai") || timezone.includes("Hong_Kong")) return "CN";
  if (timezone.includes("Europe")) return "EU";
  if (language.startsWith("en-us")) return "US";
  return "INTL";
}

export function getRegionConfig(code?: string | null) {
  if (!code) return REGION_CONFIGS[0];
  return REGION_CONFIGS.find((region) => region.code === code) ?? REGION_CONFIGS[0];
}

export function estimateImportFees(subtotal: number, _itemsCount: number, regionCode?: string | null) {
  const region = getRegionConfig(regionCode);
  const vat = 0;
  const duty = 0;
  const shipping = calculateShipping(subtotal);
  const total = subtotal + shipping;
  return { region, vat, duty, shipping, total };
}
