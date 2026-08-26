import type { LanguageCode } from "@/lib/use-language";

/** One string, translated into every supported language. */
export type TranslationEntry = Record<LanguageCode, string>;

export type TranslationDict = Record<string, TranslationEntry>;
