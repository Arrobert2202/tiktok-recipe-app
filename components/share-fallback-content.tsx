"use client";

import Link from "next/link";
import { ChefHat, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/use-language";

interface ShareFallbackContentProps {
  /** Already truncated by the server — kept as a prop so the truncate logic
   * stays in one place rather than duplicated client-side. */
  truncatedSharedText?: string;
}

export function ShareFallbackContent({ truncatedSharedText }: ShareFallbackContentProps) {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/25">
          <ChefHat className="h-7 w-7 text-white" aria-hidden="true" />
        </div>

        <h1 className="mb-3 text-2xl font-bold text-white sm:text-3xl">
          {t("share.notTikTokHeading")}
        </h1>
        <p className="mb-8 leading-relaxed text-white/50">{t("share.notTikTokBody")}</p>

        {truncatedSharedText && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/30">
              {t("share.whatWasShared")}
            </p>
            <p className="break-words font-mono text-sm leading-relaxed text-white/40">
              {truncatedSharedText}
            </p>
          </div>
        )}

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-700 hover:to-pink-600 active:scale-95"
        >
          {t("share.goToRecipeApp")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
