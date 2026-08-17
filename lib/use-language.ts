"use client";

import { useState, useEffect } from "react";

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

const STORAGE_KEY = "recipe-language";

export function useLanguage() {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  /**
   * False until the stored/browser preference has been read.
   *
   * `language` starts at "en" because localStorage and navigator are only
   * reachable after hydration. Callers that act on the language *once* on mount
   * — auto-extraction from the share sheet — would otherwise capture that "en"
   * placeholder instead of the user's real preference. Waiting on `ready`
   * closes that window.
   */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Try to load from localStorage, fallback to browser language
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
      setLanguageState(stored as LanguageCode);
    } else {
      // Detect from browser
      const browserLang = navigator.language.split("-")[0];
      const match = SUPPORTED_LANGUAGES.find(l => l.code === browserLang);
      if (match) setLanguageState(match.code);
    }

    // Unconditional, and last: every path above has now settled on a language,
    // including the no-preference case where "en" stands as the answer rather
    // than a placeholder. Gating this on a match found would strand consumers
    // waiting forever.
    setReady(true);
  }, []);

  function setLanguage(code: LanguageCode) {
    setLanguageState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }

  return { language, setLanguage, ready };
}

export function getLanguageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.name ?? "English";
}
