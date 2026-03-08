const COLOR_TAG_PREFIX = "color-";
const SIZE_TAG_PREFIX = "size-";
const MATERIAL_TAG_PREFIX = "material-";

const COLOR_LABEL_MAP: Record<string, string> = {
  black: "Black",
  white: "White",
  beige: "Beige",
  cream: "Cream",
  ivory: "Cream",
  offwhite: "Cream",
  brown: "Brown",
  tan: "Tan",
  camel: "Camel",
  khaki: "Olive",
  gray: "Gray",
  grey: "Gray",
  charcoal: "Gray",
  red: "Red",
  burgundy: "Red",
  maroon: "Red",
  wine: "Red",
  pink: "Pink",
  blush: "Pink",
  rose: "Pink",
  blue: "Blue",
  skyblue: "Blue",
  cobalt: "Blue",
  navy: "Navy",
  green: "Green",
  olive: "Olive",
  teal: "Green",
  mint: "Green",
  yellow: "Yellow",
  mustard: "Yellow",
  orange: "Orange",
  rust: "Orange",
  purple: "Purple",
  lavender: "Purple",
  lilac: "Purple",
  gold: "Gold",
  champagne: "Gold",
  silver: "Silver",
  metallic: "Silver",
  multicolor: "Multicolor",
  multicolour: "Multicolor",
  "multi color": "Multicolor",
  "two tone": "Multicolor",
  "双色": "Multicolor",
  "拼色": "Multicolor",
  "黑": "Black",
  "黑色": "Black",
  "白": "White",
  "白色": "White",
  "米白": "Cream",
  "奶白": "Cream",
  "米色": "Beige",
  "棕": "Brown",
  "棕色": "Brown",
  "咖啡": "Brown",
  "咖啡色": "Brown",
  "灰": "Gray",
  "灰色": "Gray",
  "红": "Red",
  "红色": "Red",
  "酒红": "Red",
  "酒红色": "Red",
  "粉": "Pink",
  "粉色": "Pink",
  "玫瑰粉": "Pink",
  "蓝": "Blue",
  "蓝色": "Blue",
  "藏蓝": "Navy",
  "深蓝": "Navy",
  "宝蓝": "Blue",
  "绿": "Green",
  "绿色": "Green",
  "军绿": "Olive",
  "橄榄绿": "Olive",
  "黄": "Yellow",
  "黄色": "Yellow",
  "橙": "Orange",
  "橙色": "Orange",
  "紫": "Purple",
  "紫色": "Purple",
  "金": "Gold",
  "金色": "Gold",
  "银": "Silver",
  "银色": "Silver",
  "多色": "Multicolor",
};

const SIZE_LABEL_MAP: Record<string, string> = {
  xs: "XS",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
  "2xl": "XXL",
  "3xl": "XXXL",
  "4xl": "XXXXL",
  xxs: "XXS",
  xxl: "XXL",
  xxxl: "XXXL",
  xxxxl: "XXXXL",
  os: "One Size",
  onesize: "One Size",
  "one size": "One Size",
  "free size": "One Size",
  free: "One Size",
  "one-size": "One Size",
  "均码": "One Size",
  "通码": "One Size",
  "小号": "Small",
  "中号": "Medium",
  "大号": "Large",
  small: "Small",
  medium: "Medium",
  large: "Large",
  "extra small": "XS",
  "extra large": "XL",
  mini: "Mini",
  nano: "Nano",
};

const MATERIAL_LABEL_MAP: Record<string, string> = {
  leather: "Leather",
  calfskin: "Leather",
  lambskin: "Leather",
  caviar: "Leather",
  saffiano: "Leather",
  suede: "Suede",
  canvas: "Canvas",
  coatedcanvas: "Canvas",
  denim: "Denim",
  cotton: "Cotton",
  wool: "Wool",
  silk: "Silk",
  nylon: "Nylon",
  polyester: "Polyester",
  pvc: "PVC",
  velvet: "Velvet",
  cashmere: "Cashmere",
  satin: "Satin",
  raffia: "Raffia",
  tweed: "Tweed",
  metal: "Metal",
  stainlesssteel: "Metal",
  goldtone: "Metal",
  silvertone: "Metal",
  "皮": "Leather",
  "牛皮": "Leather",
  "羊皮": "Leather",
  "麂皮": "Suede",
  "帆布": "Canvas",
  "丹宁": "Denim",
  "牛仔": "Denim",
  "棉": "Cotton",
  "羊毛": "Wool",
  "丝绸": "Silk",
  "尼龙": "Nylon",
  "聚酯纤维": "Polyester",
  "天鹅绒": "Velvet",
  "羊绒": "Cashmere",
  "拉菲草": "Raffia",
  "粗花呢": "Tweed",
  "金属": "Metal",
};

const SHOE_CONTEXT_RE =
  /\b(shoe|shoes|sneaker|sneakers|boot|boots|loafer|loafers|heel|heels|sandal|sandals|trainer|trainers|eur|eu|us|uk|it|jp|码)\b/i;

const COLOR_FROM_TEXT_RULES: Array<{ label: string; re: RegExp }> = [
  { label: "Black", re: /\b(black|jet|onyx)\b|黑色?/i },
  { label: "White", re: /\b(white)\b|白色?/i },
  { label: "Cream", re: /\b(cream|ivory|off[\s-]?white)\b|米白|奶白/i },
  { label: "Beige", re: /\b(beige|sand)\b|米色/i },
  { label: "Brown", re: /\b(brown|tan|camel|chocolate|cognac)\b|棕色?|咖啡色?|驼色/i },
  { label: "Gray", re: /\b(gray|grey|charcoal)\b|灰色?/i },
  { label: "Red", re: /\b(red|burgundy|maroon|wine)\b|红色?|酒红/i },
  { label: "Pink", re: /\b(pink|blush|rose)\b|粉色?|玫瑰粉/i },
  { label: "Blue", re: /\b(blue|sky\s*blue|cobalt|denim)\b|蓝色?|宝蓝/i },
  { label: "Navy", re: /\b(navy|midnight\s*blue)\b|藏蓝|深蓝/i },
  { label: "Green", re: /\b(green|emerald|teal|mint)\b|绿色?/i },
  { label: "Olive", re: /\b(olive|khaki)\b|军绿|橄榄绿/i },
  { label: "Yellow", re: /\b(yellow|mustard)\b|黄色?/i },
  { label: "Orange", re: /\b(orange|rust)\b|橙色?|橘色?/i },
  { label: "Purple", re: /\b(purple|lavender|lilac)\b|紫色?/i },
  { label: "Gold", re: /\b(gold|champagne)\b|金色?/i },
  { label: "Silver", re: /\b(silver|metallic)\b|银色?/i },
  { label: "Multicolor", re: /\b(multi[-\s]?color|multicolor|two[-\s]?tone)\b|多色|拼色|双色/i },
];

const MATERIAL_FROM_TEXT_RULES: Array<{ label: string; re: RegExp }> = [
  { label: "Leather", re: /\b(leather|calfskin|lambskin|caviar|saffiano)\b|牛皮|羊皮|皮革|真皮/i },
  { label: "Suede", re: /\b(suede)\b|麂皮/i },
  { label: "Canvas", re: /\b(canvas|coated\s*canvas)\b|帆布/i },
  { label: "Denim", re: /\b(denim)\b|牛仔|丹宁/i },
  { label: "Cotton", re: /\b(cotton)\b|棉/i },
  { label: "Wool", re: /\b(wool)\b|羊毛/i },
  { label: "Silk", re: /\b(silk)\b|丝绸/i },
  { label: "Nylon", re: /\b(nylon)\b|尼龙/i },
  { label: "Polyester", re: /\b(polyester)\b|聚酯纤维/i },
  { label: "Velvet", re: /\b(velvet)\b|天鹅绒/i },
  { label: "Cashmere", re: /\b(cashmere)\b|羊绒/i },
  { label: "Raffia", re: /\b(raffia)\b|拉菲草/i },
  { label: "Tweed", re: /\b(tweed)\b|粗花呢/i },
  { label: "Metal", re: /\b(metal|stainless\s*steel|gold[-\s]?tone|silver[-\s]?tone)\b|金属/i },
];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase().replace(/[\s_-]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeColorLabel(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const withoutPrefix = raw.replace(/^(color|colour|颜色|配色)\s*[:：-]?\s*/i, "").trim();
  if (!withoutPrefix) return "";
  const lowered = withoutPrefix.toLowerCase();
  const compact = lowered.replace(/[\s_-]+/g, "");
  const mapped = COLOR_LABEL_MAP[lowered] ?? COLOR_LABEL_MAP[compact];
  return mapped ?? humanize(withoutPrefix);
}

export function normalizeSizeLabel(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const withoutPrefix = raw.replace(/^(size|尺码|型号)\s*[:：-]?\s*/i, "").trim();
  if (!withoutPrefix) return "";
  const lowered = withoutPrefix.toLowerCase().replace(/\s+/g, " ").trim();
  const compact = lowered.replace(/[\s_-]+/g, "");
  const mapped = SIZE_LABEL_MAP[lowered] ?? SIZE_LABEL_MAP[compact];
  if (mapped) return mapped;

  const prefixedRangeMatch = withoutPrefix.match(
    /\b(eu|eur|us|uk|it|fr|jp)\s*[-:/]?\s*(\d{1,3}(?:\.\d+)?)\s*(?:-|\/|to)\s*(\d{1,3}(?:\.\d+)?)\b/i,
  );
  if (prefixedRangeMatch) {
    const prefix = prefixedRangeMatch[1].toUpperCase() === "EUR" ? "EU" : prefixedRangeMatch[1].toUpperCase();
    return `${prefix} ${prefixedRangeMatch[2]}-${prefixedRangeMatch[3]}`;
  }

  const cnNumericMatch = withoutPrefix.match(/(\d{1,3}(?:\.\d+)?)\s*码/);
  if (cnNumericMatch) {
    return `EU ${cnNumericMatch[1]}`;
  }

  const prefixedMatch = withoutPrefix.match(/\b(eu|eur|us|uk|it|fr|jp)\s*[-:/]?\s*(\d{1,3}(?:\.\d+)?)\b/i);
  if (prefixedMatch) {
    const prefix = prefixedMatch[1].toUpperCase() === "EUR" ? "EU" : prefixedMatch[1].toUpperCase();
    return `${prefix} ${prefixedMatch[2]}`;
  }

  const waistMatch = withoutPrefix.match(/\b([wl])\s*[-:/]?\s*(\d{2,3})\b/i);
  if (waistMatch) {
    return `${waistMatch[1].toUpperCase()}${waistMatch[2]}`;
  }

  const numericRangeMatch = withoutPrefix.match(/^(\d{2,3}(?:\.\d+)?)\s*(?:-|\/|to)\s*(\d{2,3}(?:\.\d+)?)$/i);
  if (numericRangeMatch) {
    const left = Number(numericRangeMatch[1]);
    const right = Number(numericRangeMatch[2]);
    if (left >= 32 && right <= 55) return `EU ${numericRangeMatch[1]}-${numericRangeMatch[2]}`;
  }

  if (/^\d{2,3}(\.\d+)?$/.test(withoutPrefix)) {
    const numeric = Number(withoutPrefix);
    if (numeric >= 32 && numeric <= 55) return `EU ${withoutPrefix}`;
    return withoutPrefix;
  }

  if (/^\d{1,2}(\.\d+)?$/.test(withoutPrefix)) {
    const numeric = Number(withoutPrefix);
    if (numeric >= 4 && numeric <= 15) return `US ${withoutPrefix}`;
    return withoutPrefix;
  }

  return humanize(withoutPrefix);
}

export function normalizeMaterialLabel(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const withoutPrefix = raw.replace(/^(material|材质|面料)\s*[:：-]?\s*/i, "").trim();
  if (!withoutPrefix) return "";
  const lowered = withoutPrefix.toLowerCase();
  const compact = lowered.replace(/[\s_-]+/g, "");
  const mapped = MATERIAL_LABEL_MAP[lowered] ?? MATERIAL_LABEL_MAP[compact];
  return mapped ?? humanize(withoutPrefix);
}

export function normalizeColorValues(value: unknown): string[] {
  if (value == null) return [];

  if (typeof value === "string") {
    return dedupe(
      value
        .split(/[|,;/、，；]+|\s{2,}/)
        .map((entry) => normalizeColorLabel(entry))
        .filter(Boolean),
    );
  }

  if (Array.isArray(value)) {
    return dedupe(
      value.flatMap((entry) => {
        if (typeof entry === "string") return normalizeColorValues(entry);
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        return normalizeColorValues(
            record.color ??
            record.colour ??
            record.colors ??
            record.colorOptions ??
            record.colorName ??
            record.variantColor ??
            record.name ??
            record.value ??
            record.option ??
            "",
        );
      }),
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeColorValues(
      record.color ??
        record.colour ??
        record.colors ??
        record.colorOptions ??
        record.colorName ??
        record.variants ??
        "",
    );
  }

  return [];
}

export function normalizeSizeValues(value: unknown): string[] {
  if (value == null) return [];

  if (typeof value === "string") {
    return dedupe(
      value
        .split(/[|,;/、，；]+/)
        .map((entry) => normalizeSizeLabel(entry))
        .filter(Boolean),
    );
  }

  if (Array.isArray(value)) {
    return dedupe(
      value.flatMap((entry) => {
        if (typeof entry === "string") return normalizeSizeValues(entry);
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        return normalizeSizeValues(
          record.size ??
            record.sizeName ??
            record.sizeLabel ??
            record.sizeCode ??
            record.sizes ??
            record.variantSize ??
            record.spec ??
            record.option ??
            record.value ??
            record.name ??
            "",
        );
      }),
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeSizeValues(
      record.size ??
        record.sizeName ??
        record.sizeLabel ??
        record.sizes ??
        record.variants ??
        "",
    );
  }

  return [];
}

export function normalizeMaterialValues(value: unknown): string[] {
  if (value == null) return [];

  if (typeof value === "string") {
    return dedupe(
      value
        .split(/[|,;/、，；]+/)
        .map((entry) => normalizeMaterialLabel(entry))
        .filter(Boolean),
    );
  }

  if (Array.isArray(value)) {
    return dedupe(
      value.flatMap((entry) => {
        if (typeof entry === "string") return normalizeMaterialValues(entry);
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        return normalizeMaterialValues(
          record.material ??
            record.fabric ??
            record.materialName ??
            record.materials ??
            record.value ??
            record.name ??
            "",
        );
      }),
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeMaterialValues(
      record.material ??
        record.materials ??
        record.fabric ??
        record.variants ??
        "",
    );
  }

  return [];
}

export function extractColorOptionsFromText(value: string) {
  const text = value.trim();
  if (!text) return [];

  const found: string[] = [];
  for (const rule of COLOR_FROM_TEXT_RULES) {
    if (rule.re.test(text)) {
      found.push(rule.label);
    }
  }

  const declaredColorRegex = /\b(color|colour|颜色|配色)\s*[:：]?\s*([a-zA-Z\u4e00-\u9fff\s/&-]{2,80})/gi;
  let declaredMatch = declaredColorRegex.exec(text);
  while (declaredMatch) {
    found.push(...normalizeColorValues(declaredMatch[2]));
    declaredMatch = declaredColorRegex.exec(text);
  }

  return dedupe(found.map((entry) => normalizeColorLabel(entry)).filter(Boolean));
}

export function extractSizeOptionsFromText(value: string) {
  const text = value.trim();
  if (!text) return [];
  const found: string[] = [];
  const lowered = text.toLowerCase();

  const oneSizeRegex = /\b(one[\s-]?size|free[\s-]?size|os)\b/gi;
  if (oneSizeRegex.test(lowered)) found.push("One Size");

  const alphaRegex = /\b(xxxxl|xxxl|xxl|xl|xxs|xs|s|m|l|2xl|3xl|4xl)\b/gi;
  let alphaMatch = alphaRegex.exec(lowered);
  while (alphaMatch) {
    found.push(normalizeSizeLabel(alphaMatch[1]));
    alphaMatch = alphaRegex.exec(lowered);
  }

  const prefixedRegex =
    /\b(eu|eur|us|uk|it|fr|jp)\s*[-:/]?\s*(\d{1,3}(?:\.\d+)?)(?:\s*(?:-|\/|to)\s*(\d{1,3}(?:\.\d+)?))?\b/gi;
  let prefixedMatch = prefixedRegex.exec(text);
  while (prefixedMatch) {
    const range = prefixedMatch[3] ? `${prefixedMatch[2]}-${prefixedMatch[3]}` : prefixedMatch[2];
    found.push(normalizeSizeLabel(`${prefixedMatch[1]} ${range}`));
    prefixedMatch = prefixedRegex.exec(text);
  }

  const chineseNumericRegex = /(\d{1,3}(?:\.\d+)?)\s*码/g;
  let cnMatch = chineseNumericRegex.exec(text);
  while (cnMatch) {
    found.push(normalizeSizeLabel(`${cnMatch[1]}码`));
    cnMatch = chineseNumericRegex.exec(text);
  }

  if (SHOE_CONTEXT_RE.test(lowered)) {
    const bareShoeRegex = /(?:^|[\s,\/-])(3[4-9]|4[0-9]|5[0-2])(?=$|[\s,\/-])/g;
    let bareMatch = bareShoeRegex.exec(text);
    while (bareMatch) {
      found.push(normalizeSizeLabel(`EU ${bareMatch[1]}`));
      bareMatch = bareShoeRegex.exec(text);
    }

    const bareRangeRegex = /(?:^|[\s,\/-])(3[4-9]|4[0-9]|5[0-2])\s*(?:-|\/)\s*(3[4-9]|4[0-9]|5[0-2])(?=$|[\s,\/-])/g;
    let rangeMatch = bareRangeRegex.exec(text);
    while (rangeMatch) {
      found.push(normalizeSizeLabel(`EU ${rangeMatch[1]}-${rangeMatch[2]}`));
      rangeMatch = bareRangeRegex.exec(text);
    }
  }

  if (/\bmini\b/i.test(text)) found.push("Mini");
  if (/\bsmall\b/i.test(text)) found.push("Small");
  if (/\bmedium\b/i.test(text)) found.push("Medium");
  if (/\blarge\b/i.test(text)) found.push("Large");

  return dedupe(found);
}

export function extractMaterialOptionsFromText(value: string) {
  const text = value.trim();
  if (!text) return [];

  const found: string[] = [];
  for (const rule of MATERIAL_FROM_TEXT_RULES) {
    if (rule.re.test(text)) {
      found.push(rule.label);
    }
  }

  const declaredMaterialRegex = /\b(material|fabric|材质|面料)\s*[:：]?\s*([a-zA-Z\u4e00-\u9fff\s/&-]{2,80})/gi;
  let declaredMatch = declaredMaterialRegex.exec(text);
  while (declaredMatch) {
    found.push(...normalizeMaterialValues(declaredMatch[2]));
    declaredMatch = declaredMaterialRegex.exec(text);
  }

  return dedupe(found.map((entry) => normalizeMaterialLabel(entry)).filter(Boolean));
}

function optionToTag(prefix: string, value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${prefix}${slug}` : "";
}

export function colorToTag(color: string) {
  return optionToTag(COLOR_TAG_PREFIX, color);
}

export function sizeToTag(size: string) {
  return optionToTag(SIZE_TAG_PREFIX, size);
}

export function materialToTag(material: string) {
  return optionToTag(MATERIAL_TAG_PREFIX, material);
}

export function extractColorsFromTags(tags: string[]) {
  const canonicalColors = new Set(
    [
      "Black",
      "White",
      "Beige",
      "Cream",
      "Brown",
      "Tan",
      "Camel",
      "Gray",
      "Red",
      "Pink",
      "Blue",
      "Navy",
      "Green",
      "Olive",
      "Yellow",
      "Orange",
      "Purple",
      "Gold",
      "Silver",
      "Multicolor",
    ].map((value) => value.toLowerCase()),
  );

  const prefixed = tags
    .filter((tag) => tag.toLowerCase().startsWith(COLOR_TAG_PREFIX))
    .map((tag) => tag.slice(COLOR_TAG_PREFIX.length).replace(/-/g, " "))
    .map((value) => normalizeColorLabel(value))
    .filter(Boolean);

  const plainColorTags = tags
    .map((tag) => normalizeColorLabel(tag))
    .filter((value) => canonicalColors.has(value.toLowerCase()));

  return dedupe(
    [...prefixed, ...plainColorTags],
  );
}

export function extractSizesFromTags(tags: string[]) {
  return dedupe(
    tags
      .filter((tag) => tag.toLowerCase().startsWith(SIZE_TAG_PREFIX))
      .map((tag) => tag.slice(SIZE_TAG_PREFIX.length).replace(/-/g, " "))
      .map((value) => normalizeSizeLabel(value))
      .filter(Boolean),
  );
}

export function extractMaterialsFromTags(tags: string[]) {
  return dedupe(
    tags
      .filter((tag) => tag.toLowerCase().startsWith(MATERIAL_TAG_PREFIX))
      .map((tag) => tag.slice(MATERIAL_TAG_PREFIX.length).replace(/-/g, " "))
      .map((value) => normalizeMaterialLabel(value))
      .filter(Boolean),
  );
}
