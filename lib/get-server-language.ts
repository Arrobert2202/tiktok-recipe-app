import { cookies, headers } from "next/headers";
import { normalizeLanguageCode } from "@/lib/languages";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language-cookie";
import { TRANSLATIONS, type TranslationKey } from "@/lib/translations";
import type { LanguageCode } from "@/lib/use-language";

/**
 * Server-side counterpart to useLanguage() — metadata renders before any
 * client JS runs, so it can't read localStorage. Falls back to
 * Accept-Language when no cookie exists yet (first visit, or a crawler).
 */
export async function getServerLanguage(): Promise<LanguageCode> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LANGUAGE_COOKIE_NAME)?.value;
  if (cookieValue) {
    return normalizeLanguageCode(cookieValue) as LanguageCode;
  }

  const headerList = await headers();
  const browserLang = headerList.get("accept-language")?.split(",")[0]?.split("-")[0];
  return normalizeLanguageCode(browserLang) as LanguageCode;
}

/** Server-side equivalent of useLanguage()'s t(), for metadata strings that need no interpolation. */
export function translateForMetadata(key: TranslationKey, language: LanguageCode): string {
  const entry = TRANSLATIONS[key];
  return entry?.[language] ?? entry?.en ?? key;
}
