import {
  extractColorOptionsFromText,
  extractColorsFromTags,
  extractMaterialOptionsFromText,
  extractMaterialsFromTags,
  extractSizeOptionsFromText,
  extractSizesFromTags,
  normalizeColorValues,
  normalizeMaterialValues,
  normalizeSizeValues,
} from "@/lib/utils/product-options";

type ProductAttributeInput = {
  titleEn?: string | null;
  descriptionEn?: string | null;
  tags?: string[] | null;
  variants?: Array<{
    color?: string | null;
    size?: string | null;
    material?: string | null;
  }> | null;
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
  const searchText = `${input.titleEn ?? ""} ${input.descriptionEn ?? ""}`.trim();

  const colors = dedupe([
    ...normalizeColorValues(variants.map((variant) => variant.color).filter(Boolean)),
    ...extractColorsFromTags(tags),
    ...extractColorOptionsFromText(searchText),
  ]);

  const sizes = dedupe([
    ...normalizeSizeValues(variants.map((variant) => variant.size).filter(Boolean)),
    ...extractSizesFromTags(tags),
    ...extractSizeOptionsFromText(searchText),
  ]);

  const materials = dedupe([
    ...normalizeMaterialValues(variants.map((variant) => variant.material).filter(Boolean)),
    ...extractMaterialsFromTags(tags),
    ...extractMaterialOptionsFromText(searchText),
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
