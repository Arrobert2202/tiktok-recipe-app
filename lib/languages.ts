export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ro: "Romanian",
  nl: "Dutch",
  pl: "Polish",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  hi: "Hindi",
  ar: "Arabic",
  tr: "Turkish",
};

export function getLanguageNameForCode(code: string): string {
  return LANGUAGE_NAMES[code] || "English";
}
