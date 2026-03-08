export type CatalogGroup = "all" | "dress-fabrics" | "leather-vinyl" | "lining" | "upholstery";

export const CATALOG_GROUP_OPTIONS: Array<{ value: CatalogGroup; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "dress-fabrics", label: "Dress fabrics" },
  { value: "leather-vinyl", label: "Leather & vinyl" },
  { value: "lining", label: "Lining" },
  { value: "upholstery", label: "Upholstery" },
];

export const COLOR_FILTER_OPTIONS = [
  "Black",
  "White",
  "Beige",
  "Brown",
  "Gray",
  "Red",
  "Pink",
  "Blue",
  "Green",
  "Gold",
  "Silver",
  "Multicolor",
];

export const SIZE_FILTER_OPTIONS = [
  "Swatch",
  "0.5 Meter",
  "1 Meter",
  "2 Meters",
  "3 Meters",
  "5 Meters",
  "Half Roll",
  "Full Roll",
];

export const MATERIAL_FILTER_OPTIONS = [
  "Boucle",
  "Tweed",
  "Jacquard",
  "Silk",
  "Cashmere",
  "Wool",
  "Linen",
  "Cotton",
  "Velvet",
  "Canvas",
  "Leather",
  "Technical Blend",
];

export function toFilterTag(prefix: "color" | "size" | "material", value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${prefix}-${slug}` : "";
}

export function getCatalogGroupKeywords(group?: string | null): string[] {
  switch (group) {
    case "dress-fabrics":
      return [
        "fabric",
        "textile",
        "dress",
        "jacquard",
        "cotton",
        "denim",
        "yardage",
        "canvas",
        "面料",
        "布料",
        "提花",
        "棉布",
        "牛仔",
      ];
    case "leather-vinyl":
      return [
        "leather",
        "vinyl",
        "coated",
        "embossed",
        "suede",
        "bag material",
        "皮料",
        "皮革",
        "压纹",
      ];
    case "lining":
      return [
        "lining",
        "cupro",
        "bemberg",
        "silk",
        "acetate",
        "内衬",
        "里布",
      ];
    case "upholstery":
      return [
        "upholstery",
        "interior",
        "sofa",
        "chair",
        "velvet",
        "jacquard",
        "furnishing",
        "沙发",
        "家具",
        "软装",
      ];
    default:
      return [];
  }
}
