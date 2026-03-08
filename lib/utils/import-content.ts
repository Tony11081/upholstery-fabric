import { translateDescriptionZhToEn } from "@/lib/utils/product-description";

type BuildImportDescriptionInput = {
  sourceDescription?: string | null;
  title: string;
  categoryLabel?: string | null;
  colorOptions?: string[];
  sizeOptions?: string[];
};

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function ensureSentence(input: string) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function toList(values: string[], max = 5) {
  return dedupe(values).slice(0, max).join(", ");
}

export function buildImportDescriptionEn(input: BuildImportDescriptionInput) {
  const title = input.title.trim();
  const categoryLabel = (input.categoryLabel ?? "").trim();
  const summaryFallback = [title, categoryLabel].filter(Boolean).join(" ") || "Luxury item";
  const sourceDescription = (input.sourceDescription ?? "").trim();

  const translated = sourceDescription
    ? translateDescriptionZhToEn(sourceDescription, {
        title,
        fallbackSummary: summaryFallback,
      })
    : ensureSentence(title || summaryFallback);

  const details: string[] = [];
  const colorLine = toList(input.colorOptions ?? []);
  if (colorLine) {
    details.push(`Available colors: ${colorLine}.`);
  }
  const sizeLine = toList(input.sizeOptions ?? []);
  if (sizeLine) {
    details.push(`Available sizes: ${sizeLine}.`);
  }
  details.push("Each item is quality-checked before dispatch with global tracked shipping.");

  const merged = [ensureSentence(translated), ...details].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (merged.length >= 120) return merged;

  const fallback = [
    ensureSentence(title || summaryFallback),
    categoryLabel ? `Category: ${categoryLabel}.` : "",
    ...details,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return fallback;
}
