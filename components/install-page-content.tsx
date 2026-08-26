"use client";

import Link from "next/link";
import { ChefHat, Share2, Smartphone, Apple } from "lucide-react";
import { useLanguage } from "@/lib/use-language";
import type { TranslationKey } from "@/lib/translations";

const ANDROID_STEP_KEYS: TranslationKey[] = [
  "install.android.step1",
  "install.android.step2",
  "install.android.step3",
];

const IOS_STEP_KEYS: TranslationKey[] = [
  "install.ios.step1",
  "install.ios.step2",
  "install.ios.step3",
  "install.ios.step4",
  "install.ios.step5",
  "install.ios.step6",
];

export function InstallPageContent({ shortcutUrlPrefix }: { shortcutUrlPrefix: string }) {
  const { t } = useLanguage();

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/25">
        <ChefHat className="h-7 w-7 text-white" aria-hidden="true" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">{t("install.heading")}</h1>
      <p className="text-white/70 leading-relaxed">{t("install.intro")}</p>

      {/* ─── Android ─── */}
      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="h-5 w-5 text-purple-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-white">{t("install.android.heading")}</h2>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-white/70">
          {ANDROID_STEP_KEYS.map((key) => (
            <li key={key} className="leading-relaxed">
              {t(key)}
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="h-4 w-4 text-purple-300" aria-hidden="true" />
            <p className="font-semibold text-white">{t("install.thenInTiktok")}</p>
          </div>
          <p className="text-white/80 leading-relaxed">{t("install.android.tiktokBody")}</p>
        </div>
      </section>

      {/* ─── iOS ─── */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Apple className="h-5 w-5 text-pink-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-white">{t("install.ios.heading")}</h2>
        </div>

        <p className="text-white/70 leading-relaxed">
          {t("install.ios.safariLimitation.prefix")}
          <strong className="font-semibold text-white">
            {t("install.ios.safariLimitation.bold")}
          </strong>
          {t("install.ios.safariLimitation.suffix")}
        </p>
        <p className="mt-3 text-white/70 leading-relaxed">{t("install.ios.workaroundIntro")}</p>

        <ol className="mt-5 list-decimal list-inside space-y-2 text-white/70">
          {IOS_STEP_KEYS.map((key) => (
            <li key={key} className="leading-relaxed">
              {t(key)}
            </li>
          ))}
        </ol>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/30">
            {t("install.ios.urlActionLabel")}
          </p>
          <code className="block break-all rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-purple-300">
            {shortcutUrlPrefix}
            <span className="text-pink-300">[Shortcut Input]</span>
          </code>
          <p className="mt-2 text-sm text-white/50 leading-relaxed">
            {t("install.ios.urlActionHint")}
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-pink-500/30 bg-pink-500/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="h-4 w-4 text-pink-300" aria-hidden="true" />
            <p className="font-semibold text-white">{t("install.thenInTiktok")}</p>
          </div>
          <p className="text-white/80 leading-relaxed">{t("install.tiktokBodyIos")}</p>
        </div>
      </section>

      <p className="mt-10 text-white/70 leading-relaxed">
        {t("install.footerPrefix")}
        <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
          {t("install.footerLinkText")}
        </Link>
        {t("install.footerSuffix")}
      </p>
    </main>
  );
}
