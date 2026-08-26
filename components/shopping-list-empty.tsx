"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/use-language";

export function ShoppingListEmpty() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-white">{t("shoppingList.heading")}</h1>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center backdrop-blur-sm">
          <span className="text-4xl">🛒</span>
          <p className="mt-4 text-sm text-white/70">{t("shoppingList.empty.noneSelected")}</p>
          <p className="mt-1 text-xs text-white/40">{t("shoppingList.empty.pickHint")}</p>
          <Link
            href="/cookbook"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/40 active:scale-95"
          >
            {t("shoppingList.empty.goToCookbook")}
          </Link>
        </div>
      </div>
    </main>
  );
}
