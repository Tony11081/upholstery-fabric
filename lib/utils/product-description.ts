type TranslationOptions = {
  title?: string;
  fallbackSummary?: string;
};

type Rule = {
  re: RegExp;
  label: string;
};

const MATERIAL_RULES: Rule[] = [
  { re: /(?:\u5c0f\u725b\u76ae|\u725b\u76ae|calfskin|cowhide)/i, label: "Calfskin" },
  { re: /(?:\u7f8a\u76ae|lambskin)/i, label: "Lambskin" },
  { re: /(?:\u9c84\u9c7c\u76ae|crocodile)/i, label: "Crocodile leather" },
  { re: /(?:\u9e35\u9e1f\u76ae|ostrich)/i, label: "Ostrich leather" },
  { re: /(?:\u8734\u8776\u76ae|lizard)/i, label: "Lizard leather" },
  { re: /(?:\u86c7\u76ae|python)/i, label: "Python leather" },
  { re: /(?:\u6f06\u76ae|patent)/i, label: "Patent leather" },
  { re: /(?:\u9eba\u76ae|suede)/i, label: "Suede" },
  { re: /(?:\u5e06\u5e03|canvas)/i, label: "Canvas" },
  { re: /(?:\u725b\u4ed4|denim)/i, label: "Denim" },
  { re: /(?:\u5c3c\u9f99|nylon)/i, label: "Nylon" },
  { re: /(?:\u771f\u76ae|genuine\s*leather)/i, label: "Genuine leather" },
];

const HARDWARE_RULES: Rule[] = [
  { re: /(?:\u91d1\u8272\u4e94\u91d1|\u91d1\u8272\u91d1\u5c5e|gold[-\s]?tone)/i, label: "Gold-tone hardware" },
  { re: /(?:\u94f6\u8272\u4e94\u91d1|\u94f6\u8272\u91d1\u5c5e|silver[-\s]?tone)/i, label: "Silver-tone hardware" },
  { re: /(?:\u67aa\u8272\u4e94\u91d1|\u67aa\u8272\u91d1\u5c5e|gunmetal)/i, label: "Gunmetal hardware" },
  { re: /(?:\u73ab\u7470\u91d1\u4e94\u91d1|\u73ab\u7470\u91d1|rose\s*gold)/i, label: "Rose-gold hardware" },
];

const PATTERN_RULES: Rule[] = [
  { re: /(?:\u8001\u82b1|monogram)/i, label: "Monogram" },
  { re: /(?:\u5370\u82b1|print)/i, label: "Printed" },
  { re: /(?:\u683c\u7eb9|check|plaid)/i, label: "Check pattern" },
  { re: /(?:\u6761\u7eb9|stripe)/i, label: "Stripe pattern" },
  { re: /(?:\u9c84\u9c7c\u7eb9|croc[-\s]?embossed)/i, label: "Croc-embossed" },
  { re: /(?:\u538b\u7eb9|embossed)/i, label: "Embossed" },
  { re: /(?:\u7f16\u7ec7|woven|intrecciato)/i, label: "Woven" },
];

const STYLE_RULES: Rule[] = [
  { re: /(?:\u624b\u63d0|top\s*handle)/i, label: "Top handle" },
  { re: /(?:\u659c\u630e|crossbody)/i, label: "Crossbody" },
  { re: /(?:\u5355\u80a9|shoulder)/i, label: "Shoulder" },
  { re: /(?:\u53cc\u80a9|backpack)/i, label: "Backpack" },
  { re: /(?:\u624b\u62ff|clutch)/i, label: "Clutch" },
  { re: /(?:\u6258\u7279|tote)/i, label: "Tote" },
  { re: /(?:\u6c34\u6876|bucket)/i, label: "Bucket" },
  { re: /(?:\u8170\u5305|belt\s*bag|fanny\s*pack)/i, label: "Belt bag" },
  { re: /(?:\u80f8\u5305|chest\s*bag|sling)/i, label: "Sling" },
];

const CONDITION_RULES: Rule[] = [
  { re: /(?:\u5168\u65b0|\u672a\u4f7f\u7528|brand\s*new)/i, label: "Brand new" },
  { re: /(?:\u4e5d\u6210\u65b0|9\/10|90%)/i, label: "Very good condition" },
  { re: /(?:\u516b\u6210\u65b0|8\/10|80%)/i, label: "Good condition" },
  { re: /(?:\u5b9e\u7269\u56fe|authentic)/i, label: "Quality-checked item" },
];

const COLOR_RULES: Rule[] = [
  { re: /(?:\u9ed1\u8272|\u9ed1)/i, label: "Black" },
  { re: /(?:\u767d\u8272|\u767d)/i, label: "White" },
  { re: /(?:\u7ea2\u8272|\u9152\u7ea2|\u7ea2)/i, label: "Red" },
  { re: /(?:\u7c89\u8272|\u73ab\u7470\u7c89|\u7c89)/i, label: "Pink" },
  { re: /(?:\u84dd\u8272|\u5b9d\u84dd|\u6d77\u519b\u84dd|\u84dd)/i, label: "Blue" },
  { re: /(?:\u7eff\u8272|\u519b\u7eff|\u7eff)/i, label: "Green" },
  { re: /(?:\u68d5\u8272|\u5496\u8272|\u9a7c\u8272|\u68d5|\u5496)/i, label: "Brown" },
  { re: /(?:\u7070\u8272|\u94f6\u7070|\u7070)/i, label: "Gray" },
  { re: /(?:\u7c73\u8272|\u7c73\u767d|\u5976\u767d|\u7c73)/i, label: "Beige" },
  { re: /(?:\u9ec4\u8272|\u9ec4)/i, label: "Yellow" },
  { re: /(?:\u7d2b\u8272|\u7d2b)/i, label: "Purple" },
  { re: /(?:\u6a59\u8272|\u6a59)/i, label: "Orange" },
];

const INCLUDE_RULES: Rule[] = [
  { re: /(?:\u76d2|\u539f\u76d2|box)/i, label: "Box" },
  { re: /(?:\u9632\u5c18\u888b|\u5c18\u888b|dust\s*bag)/i, label: "Dust bag" },
  { re: /(?:\u80a9\u5e26|\u80a9\u94fe|\u80cc\u5e26|strap)/i, label: "Shoulder strap" },
  { re: /(?:\u4fdd\u5361|\u5c0f\u7968|\u7968\u636e|card|receipt)/i, label: "Card/receipt" },
];

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeSource(input: string) {
  const decoded = decodeHtmlEntities(input);
  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/[【】[\]（）()]/g, " ")
    .replace(/[，,;；、|/]/g, " ")
    .replace(/[:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findFirst(rules: Rule[], text: string) {
  for (const rule of rules) {
    if (rule.re.test(text)) return rule.label;
  }
  return "";
}

function collectMatches(rules: Rule[], text: string) {
  const values = new Set<string>();
  for (const rule of rules) {
    if (rule.re.test(text)) values.add(rule.label);
  }
  return Array.from(values);
}

function extractDimensions(text: string) {
  const normalized = text.replace(/[×*]/g, "x");
  const triple = normalized.match(
    /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*(cm|CM|毫米|mm|厘米))?/,
  );
  if (triple) {
    const unit = triple[4] ?? (text.includes("mm") || text.includes("毫米") ? "mm" : "cm");
    const factor = unit === "mm" || unit === "毫米" ? 0.1 : 1;
    const dims = [triple[1], triple[2], triple[3]].map((value) =>
      (Number(value) * factor).toFixed(1).replace(/\.0$/, ""),
    );
    return `${dims.join(" x ")} cm`;
  }

  const double = normalized.match(
    /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*(cm|CM|毫米|mm|厘米))?/,
  );
  if (double) {
    const unit = double[3] ?? (text.includes("mm") || text.includes("毫米") ? "mm" : "cm");
    const factor = unit === "mm" || unit === "毫米" ? 0.1 : 1;
    const dims = [double[1], double[2]].map((value) =>
      (Number(value) * factor).toFixed(1).replace(/\.0$/, ""),
    );
    return `${dims.join(" x ")} cm`;
  }

  const single = normalized.match(/(\d+(?:\.\d+)?)(?:\s*(cm|CM|毫米|mm|厘米))/);
  if (single) {
    const unit = single[2];
    const factor = unit === "mm" || unit === "毫米" ? 0.1 : 1;
    const value = (Number(single[1]) * factor).toFixed(1).replace(/\.0$/, "");
    return `${value} cm`;
  }

  return "";
}

export function translateDescriptionZhToEn(input: string, options: TranslationOptions = {}) {
  const normalized = normalizeSource(input);
  if (!normalized) return options.title ? `${options.title}.` : "";

  if (!/[\u4e00-\u9fff]/.test(normalized)) {
    return options.title ? `${options.title}. ${normalized}` : normalized;
  }

  const summary = options.title || options.fallbackSummary || "Luxury item";
  const details: string[] = [];

  const material = findFirst(MATERIAL_RULES, normalized);
  if (material) details.push(`Material: ${material}.`);

  const hardware = findFirst(HARDWARE_RULES, normalized);
  if (hardware) details.push(`Hardware: ${hardware}.`);

  const pattern = findFirst(PATTERN_RULES, normalized);
  if (pattern) details.push(`Pattern: ${pattern}.`);

  const style = collectMatches(STYLE_RULES, normalized);
  if (style.length > 0) details.push(`Style: ${style.join(", ")}.`);

  const color = findFirst(COLOR_RULES, normalized);
  if (color) details.push(`Color: ${color}.`);

  const condition = findFirst(CONDITION_RULES, normalized);
  if (condition) details.push(`Condition: ${condition}.`);

  const includes = collectMatches(INCLUDE_RULES, normalized);
  if (includes.length > 0) details.push(`Includes: ${includes.join(", ")}.`);

  const size = extractDimensions(normalized);
  if (size) details.push(`Size: ${size}.`);

  return `${summary}.${details.length ? " " + details.join(" ") : ""}`.trim();
}
