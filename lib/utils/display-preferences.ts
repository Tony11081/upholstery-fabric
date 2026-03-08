type DisplayPreset = {
  locale: string;
  languageLabel: string;
  currency: string;
};

export type DisplayLanguage = "en" | "zh" | "pt";

export type DisplayProfile = DisplayPreset & {
  countryCode: string;
};

const DEFAULT_COUNTRY = "US";
const DEFAULT_PRESET: DisplayPreset = {
  locale: "en-US",
  languageLabel: "English",
  currency: "USD",
};

const COUNTRY_PRESETS: Record<string, DisplayPreset> = {
  US: { locale: "en-US", languageLabel: "English", currency: "USD" },
  CA: { locale: "en-CA", languageLabel: "English", currency: "CAD" },
  GB: { locale: "en-GB", languageLabel: "English", currency: "GBP" },
  IE: { locale: "en-IE", languageLabel: "English", currency: "EUR" },
  AU: { locale: "en-AU", languageLabel: "English", currency: "AUD" },
  NZ: { locale: "en-NZ", languageLabel: "English", currency: "NZD" },
  SG: { locale: "en-SG", languageLabel: "English", currency: "SGD" },
  AE: { locale: "ar-AE", languageLabel: "العربية", currency: "AED" },

  FR: { locale: "fr-FR", languageLabel: "Français", currency: "EUR" },
  DE: { locale: "de-DE", languageLabel: "Deutsch", currency: "EUR" },
  ES: { locale: "es-ES", languageLabel: "Español", currency: "EUR" },
  IT: { locale: "it-IT", languageLabel: "Italiano", currency: "EUR" },
  NL: { locale: "nl-NL", languageLabel: "Nederlands", currency: "EUR" },
  BE: { locale: "fr-BE", languageLabel: "Français", currency: "EUR" },
  PT: { locale: "pt-PT", languageLabel: "Português", currency: "EUR" },
  GR: { locale: "el-GR", languageLabel: "Ελληνικά", currency: "EUR" },
  AT: { locale: "de-AT", languageLabel: "Deutsch", currency: "EUR" },
  FI: { locale: "fi-FI", languageLabel: "Suomi", currency: "EUR" },
  DK: { locale: "da-DK", languageLabel: "Dansk", currency: "DKK" },
  NO: { locale: "nb-NO", languageLabel: "Norsk", currency: "NOK" },
  SE: { locale: "sv-SE", languageLabel: "Svenska", currency: "SEK" },
  CH: { locale: "de-CH", languageLabel: "Deutsch", currency: "CHF" },
  PL: { locale: "pl-PL", languageLabel: "Polski", currency: "PLN" },
  CZ: { locale: "cs-CZ", languageLabel: "Čeština", currency: "CZK" },

  BR: { locale: "pt-BR", languageLabel: "Português", currency: "BRL" },
  MX: { locale: "es-MX", languageLabel: "Español", currency: "MXN" },
  AR: { locale: "es-AR", languageLabel: "Español", currency: "ARS" },
  CL: { locale: "es-CL", languageLabel: "Español", currency: "CLP" },
  CO: { locale: "es-CO", languageLabel: "Español", currency: "COP" },
  PE: { locale: "es-PE", languageLabel: "Español", currency: "PEN" },

  JP: { locale: "ja-JP", languageLabel: "日本語", currency: "JPY" },
  KR: { locale: "ko-KR", languageLabel: "한국어", currency: "KRW" },
  CN: { locale: "zh-CN", languageLabel: "中文", currency: "CNY" },
  HK: { locale: "zh-HK", languageLabel: "中文", currency: "HKD" },
  TW: { locale: "zh-TW", languageLabel: "中文", currency: "TWD" },
  IN: { locale: "en-IN", languageLabel: "English", currency: "INR" },
  TH: { locale: "th-TH", languageLabel: "ไทย", currency: "THB" },
  MY: { locale: "ms-MY", languageLabel: "Bahasa Melayu", currency: "MYR" },
  ID: { locale: "id-ID", languageLabel: "Bahasa Indonesia", currency: "IDR" },
  PH: { locale: "en-PH", languageLabel: "English", currency: "PHP" },

  ZA: { locale: "en-ZA", languageLabel: "English", currency: "ZAR" },
  SA: { locale: "ar-SA", languageLabel: "العربية", currency: "SAR" },
  QA: { locale: "ar-QA", languageLabel: "العربية", currency: "QAR" },
  KW: { locale: "ar-KW", languageLabel: "العربية", currency: "KWD" },
  EG: { locale: "ar-EG", languageLabel: "العربية", currency: "EGP" },
  TR: { locale: "tr-TR", languageLabel: "Türkçe", currency: "TRY" },
  IL: { locale: "he-IL", languageLabel: "עברית", currency: "ILS" },
  RU: { locale: "ru-RU", languageLabel: "Русский", currency: "RUB" },
  UA: { locale: "uk-UA", languageLabel: "Українська", currency: "UAH" },
};

const FX_RATES_USD_BASE: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.35,
  AUD: 1.52,
  NZD: 1.64,
  BRL: 4.95,
  MXN: 17.1,
  ARS: 1090,
  CLP: 965,
  COP: 3970,
  PEN: 3.75,
  JPY: 150,
  KRW: 1330,
  CNY: 7.2,
  HKD: 7.8,
  TWD: 32.2,
  INR: 83,
  THB: 36,
  MYR: 4.7,
  IDR: 15600,
  PHP: 56,
  SGD: 1.35,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  EGP: 50,
  TRY: 31,
  ILS: 3.6,
  RUB: 92,
  UAH: 40,
  ZAR: 18.5,
  DKK: 6.85,
  NOK: 10.8,
  SEK: 10.6,
  CHF: 0.89,
  PLN: 3.98,
  CZK: 23.1,
};

export const DISPLAY_CURRENCY_OPTIONS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "BRL",
  "MXN",
  "JPY",
  "KRW",
  "CNY",
  "HKD",
  "SGD",
  "AED",
] as const;

export const DISPLAY_LANGUAGE_OPTIONS: Array<{ code: DisplayLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "pt", label: "Português" },
];

const LANGUAGE_LABEL_MAP: Record<DisplayLanguage, string> = {
  en: "English",
  zh: "中文",
  pt: "Português",
};

function normalizeCountryCode(input?: string | null) {
  if (!input) return "";
  return input.trim().toUpperCase();
}

export function normalizeDisplayLanguage(input?: string | null): DisplayLanguage | "" {
  if (!input) return "";
  const normalized = input.trim().toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh";
  if (normalized === "pt" || normalized.startsWith("pt-")) return "pt";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return "";
}

export function inferCountryFromLocale(locale?: string | null, timezone?: string | null) {
  const normalizedLocale = (locale ?? "").trim().toLowerCase();
  const normalizedTimezone = (timezone ?? "").trim().toLowerCase();

  if (/pt-br/.test(normalizedLocale)) return "BR";
  if (/es-mx/.test(normalizedLocale)) return "MX";
  if (/es-es/.test(normalizedLocale)) return "ES";
  if (/fr-fr/.test(normalizedLocale)) return "FR";
  if (/de-de/.test(normalizedLocale)) return "DE";
  if (/it-it/.test(normalizedLocale)) return "IT";
  if (/ja-jp/.test(normalizedLocale)) return "JP";
  if (/ko-kr/.test(normalizedLocale)) return "KR";
  if (/zh-cn/.test(normalizedLocale)) return "CN";
  if (/zh-hk/.test(normalizedLocale)) return "HK";
  if (/zh-tw/.test(normalizedLocale)) return "TW";
  if (/en-gb/.test(normalizedLocale)) return "GB";
  if (/en-ca/.test(normalizedLocale)) return "CA";
  if (/en-au/.test(normalizedLocale)) return "AU";

  if (normalizedTimezone.includes("sao_paulo")) return "BR";
  if (normalizedTimezone.includes("mexico")) return "MX";
  if (normalizedTimezone.includes("tokyo")) return "JP";
  if (normalizedTimezone.includes("seoul")) return "KR";
  if (normalizedTimezone.includes("shanghai")) return "CN";
  if (normalizedTimezone.includes("hong_kong")) return "HK";
  if (normalizedTimezone.includes("london")) return "GB";
  if (normalizedTimezone.includes("toronto") || normalizedTimezone.includes("vancouver")) return "CA";
  if (normalizedTimezone.includes("sydney") || normalizedTimezone.includes("melbourne")) return "AU";

  return DEFAULT_COUNTRY;
}

export function resolveDisplayProfile(params?: {
  countryCode?: string | null;
  localeHint?: string | null;
  timezoneHint?: string | null;
}): DisplayProfile {
  const directCode = normalizeCountryCode(params?.countryCode);
  const inferredCode = inferCountryFromLocale(params?.localeHint, params?.timezoneHint);
  const countryCode = directCode || inferredCode || DEFAULT_COUNTRY;
  const preset = COUNTRY_PRESETS[countryCode] ?? DEFAULT_PRESET;
  return { countryCode, ...preset };
}

export function resolveLocaleByLanguage(
  language: DisplayLanguage | "",
  countryCode: string,
  fallbackLocale: string,
) {
  if (!language) return fallbackLocale;
  if (language === "zh") {
    if (countryCode === "HK") return "zh-HK";
    if (countryCode === "TW") return "zh-TW";
    return "zh-CN";
  }
  if (language === "pt") {
    return countryCode === "PT" ? "pt-PT" : "pt-BR";
  }
  return "en-US";
}

export function resolveLanguageLabel(
  language: DisplayLanguage | "",
  fallbackLabel: string,
) {
  if (!language) return fallbackLabel;
  return LANGUAGE_LABEL_MAP[language];
}

export function convertUsdToCurrency(amountUsd: number, targetCurrency: string) {
  const safeAmount = Number.isFinite(amountUsd) ? amountUsd : 0;
  const currency = targetCurrency.trim().toUpperCase();
  const rate = FX_RATES_USD_BASE[currency] ?? 1;
  return safeAmount * rate;
}
