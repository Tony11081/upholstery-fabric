export type CountryOption = {
  code: string;
  label: string;
  dialCode: string;
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "US", label: "United States", dialCode: "+1" },
  { code: "CA", label: "Canada", dialCode: "+1" },
  { code: "MX", label: "Mexico", dialCode: "+52" },
  { code: "BR", label: "Brazil", dialCode: "+55" },
  { code: "AR", label: "Argentina", dialCode: "+54" },
  { code: "CL", label: "Chile", dialCode: "+56" },
  { code: "CO", label: "Colombia", dialCode: "+57" },
  { code: "PE", label: "Peru", dialCode: "+51" },
  { code: "GB", label: "United Kingdom", dialCode: "+44" },
  { code: "IE", label: "Ireland", dialCode: "+353" },
  { code: "FR", label: "France", dialCode: "+33" },
  { code: "DE", label: "Germany", dialCode: "+49" },
  { code: "ES", label: "Spain", dialCode: "+34" },
  { code: "IT", label: "Italy", dialCode: "+39" },
  { code: "NL", label: "Netherlands", dialCode: "+31" },
  { code: "BE", label: "Belgium", dialCode: "+32" },
  { code: "SE", label: "Sweden", dialCode: "+46" },
  { code: "NO", label: "Norway", dialCode: "+47" },
  { code: "DK", label: "Denmark", dialCode: "+45" },
  { code: "FI", label: "Finland", dialCode: "+358" },
  { code: "CH", label: "Switzerland", dialCode: "+41" },
  { code: "AT", label: "Austria", dialCode: "+43" },
  { code: "PL", label: "Poland", dialCode: "+48" },
  { code: "CZ", label: "Czechia", dialCode: "+420" },
  { code: "PT", label: "Portugal", dialCode: "+351" },
  { code: "GR", label: "Greece", dialCode: "+30" },
  { code: "TR", label: "Turkey", dialCode: "+90" },
  { code: "RU", label: "Russia", dialCode: "+7" },
  { code: "UA", label: "Ukraine", dialCode: "+380" },
  { code: "IL", label: "Israel", dialCode: "+972" },
  { code: "AE", label: "United Arab Emirates", dialCode: "+971" },
  { code: "SA", label: "Saudi Arabia", dialCode: "+966" },
  { code: "QA", label: "Qatar", dialCode: "+974" },
  { code: "KW", label: "Kuwait", dialCode: "+965" },
  { code: "BH", label: "Bahrain", dialCode: "+973" },
  { code: "OM", label: "Oman", dialCode: "+968" },
  { code: "EG", label: "Egypt", dialCode: "+20" },
  { code: "MA", label: "Morocco", dialCode: "+212" },
  { code: "ZA", label: "South Africa", dialCode: "+27" },
  { code: "NG", label: "Nigeria", dialCode: "+234" },
  { code: "KE", label: "Kenya", dialCode: "+254" },
  { code: "IN", label: "India", dialCode: "+91" },
  { code: "PK", label: "Pakistan", dialCode: "+92" },
  { code: "BD", label: "Bangladesh", dialCode: "+880" },
  { code: "LK", label: "Sri Lanka", dialCode: "+94" },
  { code: "ID", label: "Indonesia", dialCode: "+62" },
  { code: "SG", label: "Singapore", dialCode: "+65" },
  { code: "MY", label: "Malaysia", dialCode: "+60" },
  { code: "TH", label: "Thailand", dialCode: "+66" },
  { code: "VN", label: "Vietnam", dialCode: "+84" },
  { code: "PH", label: "Philippines", dialCode: "+63" },
  { code: "JP", label: "Japan", dialCode: "+81" },
  { code: "KR", label: "South Korea", dialCode: "+82" },
  { code: "CN", label: "China", dialCode: "+86" },
  { code: "HK", label: "Hong Kong", dialCode: "+852" },
  { code: "TW", label: "Taiwan", dialCode: "+886" },
  { code: "AU", label: "Australia", dialCode: "+61" },
  { code: "NZ", label: "New Zealand", dialCode: "+64" },
];

const COUNTRY_ALIASES: Record<string, string> = {
  USA: "US",
  "UNITED STATES OF AMERICA": "US",
  "UNITED STATES": "US",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  ENGLAND: "GB",
  GREATBRITAIN: "GB",
  "GREAT BRITAIN": "GB",
  KOREA: "KR",
  "SOUTH KOREA": "KR",
  PRC: "CN",
  "PEOPLE'S REPUBLIC OF CHINA": "CN",
  UAE: "AE",
};

export function resolveCountryCode(value?: string, fallback = "US") {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const upper = trimmed.toUpperCase();
  if (COUNTRY_ALIASES[upper]) return COUNTRY_ALIASES[upper];
  const codeMatch = COUNTRY_OPTIONS.find((option) => option.code === upper);
  if (codeMatch) return codeMatch.code;
  const labelMatch = COUNTRY_OPTIONS.find(
    (option) => option.label.toUpperCase() === upper,
  );
  return labelMatch?.code ?? fallback;
}

export const CALLING_CODE_OPTIONS = COUNTRY_OPTIONS.map((option) => ({
  dialCode: option.dialCode,
  label: `${option.dialCode} ${option.label}`,
}));

export function resolveDialCodeByCountry(code?: string, fallback = "+1") {
  if (!code) return fallback;
  const upper = code.trim().toUpperCase();
  const match = COUNTRY_OPTIONS.find((option) => option.code === upper);
  return match?.dialCode ?? fallback;
}
