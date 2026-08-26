"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { TRANSLATIONS, type TranslationKey } from "@/lib/translations";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language-cookie";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "ro", name: "Română", flag: "🇷🇴" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  ready: boolean;
  /** Looks up a translation key for the current language, falling back to
   * English and then the raw key if a translation is missing. `params`
   * substitutes `{name}` placeholders in the template. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /**
   * Reads `${baseKey}.one` / `${baseKey}.other` depending on `count` and
   * substitutes `{count}`. A deliberate two-form simplification (English-
   * style singular/plural) rather than full ICU plural rules — languages
   * with more grammatical plural forms (Arabic, Polish, ...) get the
   * "other" form for every count but 1. Not narrowed to `TranslationKey`
   * since the suffixed key isn't itself a standalone dictionary entry.
   */
  tCount: (baseKey: string, count: number) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

/**
 * Single source of truth for the language preference, shared across the
 * whole tree via Context. Previously `useLanguage` was a plain hook — every
 * caller got its own independent `useState`, only synced to localStorage on
 * that component's own mount, so changing the language in one already-
 * mounted component (e.g. the navbar) never propagated to another (e.g. the
 * landing page) without a full reload. The translation system needs one
 * consistent, live value everywhere anyway, so this fixes both at once.
 */
/**
 * Writes both localStorage (read on the client's next mount) and a cookie
 * (read server-side by getServerLanguage() so page <title>/description can
 * match before any client JS runs). A year-long cookie lifetime matches the
 * "set once, stays" feel localStorage already has.
 */
function persistLanguage(code: LanguageCode) {
  localStorage.setItem(LANGUAGE_COOKIE_NAME, code);
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${code}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_COOKIE_NAME);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      setLanguageState(stored as LanguageCode);
      // Backfills the cookie for visitors who picked a language before the
      // cookie existed — otherwise the server keeps guessing from
      // Accept-Language forever even though the client already knows better.
      persistLanguage(stored as LanguageCode);
    } else {
      const browserLang = navigator.language.split("-")[0];
      const match = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang);
      if (match) {
        setLanguageState(match.code);
        persistLanguage(match.code);
      }
    }
    setReady(true);
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    persistLanguage(code);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const entry = TRANSLATIONS[key];
      const template = entry?.[language] ?? entry?.en ?? key;
      return interpolate(template, params);
    },
    [language]
  );

  const tCount = useCallback(
    (baseKey: string, count: number) => {
      const suffix = count === 1 ? "one" : "other";
      const fullKey = `${baseKey}.${suffix}`;
      const entry = (TRANSLATIONS as Record<string, TranslationEntryLike>)[fullKey];
      const template = entry?.[language] ?? entry?.en ?? fullKey;
      return interpolate(template, { count });
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, ready, t, tCount }}>
      {children}
    </LanguageContext.Provider>
  );
}

type TranslationEntryLike = Record<LanguageCode, string>;

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

export function getLanguageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}
