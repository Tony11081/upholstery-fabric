import { slugify } from "@/lib/utils/slug";

const BRAND_DISPLAY: Record<string, string> = {
  "balenciaga": "Balenciaga",
  "bottega-veneta": "Bottega Veneta",
  "burberry": "Burberry",
  "bvlgari": "Bvlgari",
  "cartier": "Cartier",
  "celine": "Celine",
  "chanel": "Chanel",
  "chloe": "Chloe",
  "chopard": "Chopard",
  "chrome-hearts": "Chrome Hearts",
  "coach": "Coach",
  "dior": "Dior",
  "fendi": "Fendi",
  "gentle-monster": "Gentle Monster",
  "givenchy": "Givenchy",
  "goyard": "Goyard",
  "graff": "Graff",
  "guess": "Guess",
  "gucci": "Gucci",
  "hermes": "Hermes",
  "kate-spade": "Kate Spade",
  "kurt-geiger": "Kurt Geiger",
  "longchamp": "Longchamp",
  "loewe": "Loewe",
  "loro-piana": "Loro Piana",
  "louis-vuitton": "Louis Vuitton",
  "maison-margiela": "Maison Margiela",
  "mansur-gavriel": "Mansur Gavriel",
  "mcm": "MCM",
  "messika": "Messika",
  "michael-kors": "Michael Kors",
  "miu-miu": "Miu Miu",
  "montblanc": "Montblanc",
  "prada": "Prada",
  "salvatore-ferragamo": "Salvatore Ferragamo",
  "saint-laurent": "Saint Laurent",
  "tiffany-co": "Tiffany & Co.",
  "tory-burch": "Tory Burch",
  "valentino": "Valentino",
  "van-cleef-arpels": "Van Cleef & Arpels",
  "versace": "Versace",
};

const BRAND_TAG_ALIASES: Record<string, string> = {
  "lv": "louis-vuitton",
  "louisvuitton": "louis-vuitton",
  "ysl": "saint-laurent",
  "yves-saint-laurent": "saint-laurent",
  "saintlaurent": "saint-laurent",
  "bottega": "bottega-veneta",
  "bv": "bottega-veneta",
  "miumiu": "miu-miu",
  "bulgari": "bvlgari",
  "tiffany": "tiffany-co",
  "tiffanyco": "tiffany-co",
  "gentlemonster": "gentle-monster",
  "chromehearts": "chrome-hearts",
  "michaelkors": "michael-kors",
  "mansurgavriel": "mansur-gavriel",
  "toryburch": "tory-burch",
  "vca": "van-cleef-arpels",
  "vancleef": "van-cleef-arpels",
  "van-cleef": "van-cleef-arpels",
  "chloe": "chloe",
  "katespade": "kate-spade",
  "longchamp": "longchamp",
  "loropiana": "loro-piana",
};

export type BrandInfo = {
  label: string;
  tag: string;
};

function normalizeBrandTag(tag: string): string | null {
  const slug = slugify(tag);
  const canonical = BRAND_TAG_ALIASES[slug] ?? slug;
  return BRAND_DISPLAY[canonical] ? canonical : null;
}

export function getBrandInfo(input: { tags?: string[] | null; titleEn?: string | null }): BrandInfo | null {
  const tags = input.tags ?? [];
  for (const tag of tags) {
    const normalized = normalizeBrandTag(tag);
    if (normalized) {
      return { label: BRAND_DISPLAY[normalized], tag: normalized };
    }
  }

  const title = input.titleEn ? `-${slugify(input.titleEn)}-` : "";
  if (!title) return null;

  for (const slug of Object.keys(BRAND_DISPLAY)) {
    if (title.includes(`-${slug}-`)) {
      return { label: BRAND_DISPLAY[slug], tag: slug };
    }
  }

  for (const [alias, canonical] of Object.entries(BRAND_TAG_ALIASES)) {
    if (title.includes(`-${alias}-`)) {
      return { label: BRAND_DISPLAY[canonical], tag: canonical };
    }
  }

  return null;
}
