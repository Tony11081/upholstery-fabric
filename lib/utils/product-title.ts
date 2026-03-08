type NormalizedTitle = {
  title: string;
  brand?: string;
  category?: string;
};

type NormalizerOptions = {
  fallbackBrand?: string;
  fallbackCategory?: string;
};

const BRAND_PATTERNS: Array<{ label: string; slug: string; re: RegExp }> = [
  {
    label: "Louis Vuitton",
    slug: "louis-vuitton",
    re: /(?:\u8def\u6613\u5a01\u767b|\bLouis\s*Vuitton\b|\bLV\b)/i,
  },
  {
    label: "Chanel",
    slug: "chanel",
    re: /(?:\u9999\u5948\u513f|\bChanel\b)/i,
  },
  {
    label: "Hermes",
    slug: "hermes",
    re: /(?:\u7231\u9a6c\u4ed5|\bHermes\b)/i,
  },
  {
    label: "Gucci",
    slug: "gucci",
    re: /(?:\u53e4\u9a70|\bGucci\b)/i,
  },
  {
    label: "Prada",
    slug: "prada",
    re: /(?:\u666e\u62c9\u8fbe|\bPrada\b)/i,
  },
  {
    label: "Dior",
    slug: "dior",
    re: /(?:\u8fea\u5965|\bDior\b)/i,
  },
  {
    label: "Fendi",
    slug: "fendi",
    re: /(?:\u82ac\u8fea|\bFendi\b)/i,
  },
  {
    label: "Celine",
    slug: "celine",
    re: /(?:\u8d5b\u7433|\u585e\u7433|\bCeline\b)/i,
  },
  {
    label: "Balenciaga",
    slug: "balenciaga",
    re: /(?:\u5df4\u9ece\u4e16\u5bb6|\bBalenciaga\b)/i,
  },
  {
    label: "Bottega Veneta",
    slug: "bottega-veneta",
    re: /(?:\u8446\u8776\u5bb6|\bBottega\b|\bVeneta\b|\bBV\b)/i,
  },
  {
    label: "Saint Laurent",
    slug: "saint-laurent",
    re: /(?:\u5723\u7f57\u5170|\u5723\u6d1b\u5170|\bSaint\s*Laurent\b|\bYSL\b)/i,
  },
  {
    label: "Burberry",
    slug: "burberry",
    re: /(?:\u535a\u67cf\u5229|\u5df4\u5b9d\u8389|\bBurberry\b)/i,
  },
  {
    label: "Givenchy",
    slug: "givenchy",
    re: /(?:\u7eaa\u68b5\u5e0c|\bGivenchy\b)/i,
  },
  {
    label: "Valentino",
    slug: "valentino",
    re: /(?:\u534e\u4f26\u5929\u5974|\bValentino\b)/i,
  },
  {
    label: "Versace",
    slug: "versace",
    re: /(?:\u8303\u601d\u54f2|\bVersace\b)/i,
  },
  {
    label: "Loewe",
    slug: "loewe",
    re: /(?:\u7f57\u610f\u5a01|\bLoewe\b)/i,
  },
  {
    label: "Miu Miu",
    slug: "miu-miu",
    re: /(?:\u7f2a\u7f2a|\bMiu\s*Miu\b)/i,
  },
  {
    label: "Bvlgari",
    slug: "bvlgari",
    re: /(?:\u5b9d\u683c\u4e3d|\bBvlgari\b)/i,
  },
  {
    label: "Van Cleef & Arpels",
    slug: "van-cleef-arpels",
    re: /(?:\u68b5\u514b\u96c5\u5b9d|\bVan\s*Cleef\b|\bVCA\b)/i,
  },
  {
    label: "Coach",
    slug: "coach",
    re: /(?:\bCoach\b)/i,
  },
];

const BRAND_STOP_TOKENS = new Set(
  BRAND_PATTERNS.flatMap((brand) => {
    const parts = brand.label.toLowerCase().split(" ");
    return [brand.slug, ...parts, brand.slug.replace(/-/g, "")];
  }).concat(["lv", "ysl", "bv", "vca"]),
);

const CATEGORY_PATTERNS: Array<{ label: string; slug: string; re: RegExp }> = [
  {
    label: "Card Holder",
    slug: "card-holder",
    re: /(?:\u5361\u5305|\u5361\u5939|\u5361\u5957|card\s*holder|card\s*case)/i,
  },
  {
    label: "Wallet",
    slug: "wallet",
    re: /(?:\u94b1\u5305|\u94b1\u5939|\u957f\u5939|\u77ed\u5939|wallet)/i,
  },
  {
    label: "Clutch",
    slug: "clutch",
    re: /(?:\u624b\u62ff\u5305|\u665a\u5bb4\u5305|\u624b\u5305|clutch)/i,
  },
  {
    label: "Belt",
    slug: "belt",
    re: /(?:\u76ae\u5e26|\u8170\u5e26|belt)/i,
  },
  {
    label: "Scarf",
    slug: "scarf",
    re: /(?:\u56f4\u5dfe|\u62ab\u80a9|scarf)/i,
  },
  {
    label: "Backpack",
    slug: "backpack",
    re: /(?:\u53cc\u80a9\u5305|\u80cc\u5305|backpack)/i,
  },
  {
    label: "Crossbody Bag",
    slug: "crossbody-bag",
    re: /(?:\u659c\u630e\u5305|crossbody)/i,
  },
  {
    label: "Shoulder Bag",
    slug: "shoulder-bag",
    re: /(?:\u5355\u80a9\u5305|shoulder\s*bag)/i,
  },
  {
    label: "Tote Bag",
    slug: "tote-bag",
    re: /(?:\u6258\u7279\u5305|\u8d2d\u7269\u888b|tote\s*bag|tote)/i,
  },
  {
    label: "Bucket Bag",
    slug: "bucket-bag",
    re: /(?:\u6c34\u6876\u5305|bucket\s*bag|bucket)/i,
  },
  {
    label: "Handbag",
    slug: "handbag",
    re: /(?:\u624b\u63d0\u5305|\u624b\u888b|handbag)/i,
  },
  {
    label: "Bag",
    slug: "bag",
    re: /(?:\u5305|bag)/i,
  },
  {
    label: "Sneakers",
    slug: "sneakers",
    re: /(?:\u8fd0\u52a8\u978b|\u7403\u978b|sneaker)/i,
  },
  {
    label: "Boots",
    slug: "boots",
    re: /(?:\u9774|boot)/i,
  },
  {
    label: "Sandals",
    slug: "sandals",
    re: /(?:\u51c9\u978b|sandal)/i,
  },
  {
    label: "Heels",
    slug: "heels",
    re: /(?:\u9ad8\u8ddf|heel|pump)/i,
  },
  {
    label: "Shoes",
    slug: "shoes",
    re: /(?:\u978b|shoe)/i,
  },
  {
    label: "Loafers",
    slug: "loafers",
    re: /(?:loafer|\u4e50\u798f\u978b)/i,
  },
  {
    label: "Flats",
    slug: "flats",
    re: /(?:flat|ballet\s*flat|\u5e73\u5e95\u978b)/i,
  },
  {
    label: "Necklace",
    slug: "necklace",
    re: /(?:\u9879\u94fe|\u540a\u5760|necklace)/i,
  },
  {
    label: "Ring",
    slug: "ring",
    re: /(?:\u6212\u6307|ring)/i,
  },
  {
    label: "Bracelet",
    slug: "bracelet",
    re: /(?:\u624b\u94fe|\u624b\u956f|bracelet|bangle)/i,
  },
  {
    label: "Earrings",
    slug: "earrings",
    re: /(?:\u8033\u73af|\u8033\u949b|earring)/i,
  },
  {
    label: "Brooch",
    slug: "brooch",
    re: /(?:\u80f8\u9488|brooch)/i,
  },
  {
    label: "Watch",
    slug: "watch",
    re: /(?:\u624b\u8868|watch)/i,
  },
  {
    label: "Sunglasses",
    slug: "sunglasses",
    re: /(?:\u592a\u9633\u955c|\u58a8\u955c|sunglasses)/i,
  },
  {
    label: "Hat",
    slug: "hat",
    re: /(?:\u5e3d|hat)/i,
  },
  {
    label: "Dress",
    slug: "dress",
    re: /(?:dress|\u8fde\u8863\u88d9)/i,
  },
  {
    label: "Top",
    slug: "top",
    re: /(?:shirt|t-shirt|tee|blouse|sweater|hoodie|\u4e0a\u8863|\u886c\u886b|\u9488\u7ec7\u886b)/i,
  },
  {
    label: "Jacket",
    slug: "jacket",
    re: /(?:jacket|blazer|\u5939\u514b|\u897f\u88c5\u5916\u5957)/i,
  },
  {
    label: "Coat",
    slug: "coat",
    re: /(?:coat|\u5927\u8863|\u98ce\u8863)/i,
  },
  {
    label: "Skirt",
    slug: "skirt",
    re: /(?:skirt|\u534a\u88d9|\u957f\u88d9|\u77ed\u88d9)/i,
  },
  {
    label: "Pants",
    slug: "pants",
    re: /(?:pants|trousers|leggings|\u88e4\u5b50|\u957f\u88e4)/i,
  },
  {
    label: "Jeans",
    slug: "jeans",
    re: /(?:jeans?|\u725b\u4ed4\u88e4)/i,
  },
];

const CATEGORY_STOP_TOKENS = new Set([
  "bag",
  "bags",
  "handbag",
  "tote",
  "shoulder",
  "crossbody",
  "backpack",
  "wallet",
  "card",
  "holder",
  "clutch",
  "belt",
  "scarf",
  "shoe",
  "shoes",
  "sneaker",
  "sneakers",
  "boot",
  "boots",
  "sandal",
  "sandals",
  "heel",
  "heels",
  "loafer",
  "loafers",
  "flat",
  "flats",
  "ring",
  "bracelet",
  "earring",
  "earrings",
  "necklace",
  "brooch",
  "watch",
  "hat",
  "sunglasses",
  "dress",
  "shirt",
  "tee",
  "blouse",
  "sweater",
  "hoodie",
  "jacket",
  "blazer",
  "coat",
  "skirt",
  "pants",
  "trousers",
  "jeans",
]);

const SIZE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "Mini", re: /(?:\u8d85\u5c0f|\u8ff7\u4f60|mini)/i },
  { label: "Small", re: /(?:\u5c0f\u53f7|\u5c0f\u6b3e|small)/i },
  { label: "Medium", re: /(?:\u4e2d\u53f7|\u4e2d\u6b3e|medium)/i },
  { label: "Large", re: /(?:\u5927\u53f7|\u5927\u6b3e|large)/i },
];

const MODEL_TOKEN_RE = /[A-Za-z][A-Za-z0-9-]{1,}|\b\d{2,4}\b/g;
const MODEL_STOP_TOKENS = new Set([
  ...BRAND_STOP_TOKENS,
  ...CATEGORY_STOP_TOKENS,
  "cm",
  "mm",
  "usd",
  "rmb",
  "cny",
  "new",
  "authentic",
  "classic",
  "color",
  "size",
  "small",
  "medium",
  "large",
]);

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function detectBrand(sourceTitle: string) {
  for (const brand of BRAND_PATTERNS) {
    if (brand.re.test(sourceTitle)) return brand;
  }
  return null;
}

function detectCategory(sourceTitle: string) {
  for (const category of CATEGORY_PATTERNS) {
    if (category.re.test(sourceTitle)) return category;
  }
  return null;
}

function detectSize(sourceTitle: string) {
  for (const size of SIZE_PATTERNS) {
    if (size.re.test(sourceTitle)) return size.label;
  }
  return null;
}

function extractModelTokens(sourceTitle: string) {
  const tokens: Array<{ value: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = MODEL_TOKEN_RE.exec(sourceTitle))) {
    const raw = match[0];
    const normalized = raw.toLowerCase();
    if (MODEL_STOP_TOKENS.has(normalized)) continue;
    const value = raw.length <= 3 ? raw.toUpperCase() : raw;
    tokens.push({ value, index: match.index });
  }

  const seen = new Set<string>();
  return tokens
    .sort((a, b) => a.index - b.index)
    .map((token) => token.value)
    .filter((token) => {
      const key = token.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeTitleFromSource(
  sourceTitle: string,
  options: NormalizerOptions = {},
): NormalizedTitle | null {
  const normalized = normalizeWhitespace(sourceTitle);
  if (!normalized) return null;

  const brandMatch = detectBrand(normalized);
  const categoryMatch = detectCategory(normalized);
  const sizeToken = detectSize(normalized);
  const modelTokens = extractModelTokens(normalized);

  if (sizeToken && !modelTokens.includes(sizeToken)) {
    modelTokens.push(sizeToken);
  }

  const brand = brandMatch?.label ?? options.fallbackBrand;
  const category = categoryMatch?.label ?? options.fallbackCategory;
  const parts = [brand, modelTokens.join(" "), category].filter(Boolean);
  const title = normalizeWhitespace(parts.join(" "));

  if (!title) return null;

  return {
    title,
    brand: brandMatch?.label,
    category: categoryMatch?.label,
  };
}
