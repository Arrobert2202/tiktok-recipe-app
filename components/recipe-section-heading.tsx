"use client";

import { useLanguage } from "@/lib/use-language";
import type { TranslationKey } from "@/lib/translations";

interface RecipeSectionHeadingProps {
  translationKey: TranslationKey;
  className: string;
}

/**
 * Shared heading for "Ingredients"/"Steps"/"Tips & Tricks", used identically
 * in both app/r/[slug]/page.tsx and app/recipe/[id]/page.tsx — both server
 * components, so this small client leaf is what actually renders the
 * translated text. `className` is passed through rather than hardcoded
 * since the two call sites use slightly different spacing (mb-3 vs mb-4).
 */
export function RecipeSectionHeading({ translationKey, className }: RecipeSectionHeadingProps) {
  const { t } = useLanguage();
  return <h2 className={className}>{t(translationKey)}</h2>;
}
