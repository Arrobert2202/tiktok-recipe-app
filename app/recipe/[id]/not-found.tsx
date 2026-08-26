"use client";

import { useLanguage } from "@/lib/use-language";

export default function RecipeNotFound() {
  const { t } = useLanguage();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-white mb-2">
        {t("recipeDetail.notFound.heading")}
      </h1>
      <p className="text-white/60">{t("recipeDetail.notFound.recipeBody")}</p>
    </main>
  );
}
