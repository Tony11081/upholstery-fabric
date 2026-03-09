import {
  extractColorsFromTags,
  extractMaterialsFromTags,
  extractSizesFromTags,
  extractColorOptionsFromText,
  normalizeColorValues,
  normalizeMaterialValues,
  normalizeSizeValues,
} from "@/lib/utils/product-options";

type ProductAttributeInput = {
  titleEn?: string | null;
  descriptionEn?: string | null;
  tags?: string[] | null;
  category?: {
    nameEn?: string | null;
  } | null;
  variants?: Array<{
    color?: string | null;
    size?: string | null;
    material?: string | null;
  }> | null;
};

const CATEGORY_MATERIAL_FALLBACKS: Record<string, string> = {
  jacquard: "Jacquard",
  leather: "Leather",
  vinyl: "Vinyl",
  cotton: "Cotton",
  denim: "Denim",
  lining: "Lining",
  upholstery: "Upholstery",
  "fashion fabrics": "Designer Fabric",
};

function dedupe(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getProductAttributeValues(input: ProductAttributeInput) {
  const tags = input.tags ?? [];
  const variants = input.variants ?? [];
  const title = input.titleEn ?? "";
  const categoryName = input.category?.nameEn?.trim().toLowerCase() ?? "";

  const colors = dedupe([
    ...normalizeColorValues(variants.map((variant) => variant.color).filter(Boolean)),
    ...extractColorsFromTags(tags),
    ...extractColorOptionsFromText(title),
  ]);

  const sizes = dedupe([
    ...normalizeSizeValues(variants.map((variant) => variant.size).filter(Boolean)),
    ...extractSizesFromTags(tags),
    "1 Yard",
  ]);

  const materials = dedupe([
    ...normalizeMaterialValues(variants.map((variant) => variant.material).filter(Boolean)),
    ...extractMaterialsFromTags(tags),
    ...(categoryName && CATEGORY_MATERIAL_FALLBACKS[categoryName]
      ? [CATEGORY_MATERIAL_FALLBACKS[categoryName]]
      : []),
  ]);

  return {
    colors,
    sizes,
    materials,
    primaryColor: colors[0] ?? null,
    primarySize: sizes[0] ?? null,
    primaryMaterial: materials[0] ?? null,
  };
}
