"use client";

import { useLanguage } from "@/lib/use-language";

export function CookbookHeader({ count }: { count: number }) {
  const { t, tCount } = useLanguage();
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-white">{t("cookbook.pageHeading")}</h1>
      <p className="mt-1 text-sm text-white/50">{tCount("cookbook.savedCount", count)}</p>
    </div>
  );
}
