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

/**
 * Normalizes a caller-supplied language code to one of the known keys in
 * `LANGUAGE_NAMES`, defaulting to "en".
 *
 * `language` reaches the extraction actions as free-form, unvalidated
 * input — the UI constrains it to a known set, but nothing stops a direct
 * server-action call from passing anything. Once `language` also became
 * part of the recipe_cache lookup key, an unnormalized value stopped being
 * just a display concern: "en", "En ", and "eN" would each fragment the
 * cache into a separate entry for what's really the same request. This is
 * the single point where a value becomes canonical before it's used for
 * either the cache key or the parser call.
 */
export function normalizeLanguageCode(input?: string): string {
  const normalized = input?.trim().toLowerCase();
  if (normalized && normalized in LANGUAGE_NAMES) {
    return normalized;
  }
  return "en";
}
