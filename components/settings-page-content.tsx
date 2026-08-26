"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { useLanguage } from "@/lib/use-language";

interface SettingsPageContentProps {
  email: string;
  name: string | null;
  credits: number;
}

/**
 * `app/settings/page.tsx` stays a server component so it can check the
 * session and redirect before rendering anything — this just receives the
 * data it already fetched and renders the translated UI around it.
 */
export function SettingsPageContent({ email, name, credits }: SettingsPageContentProps) {
  const { t, tCount } = useLanguage();

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white">{t("settings.heading")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("settings.subheading")}</p>

        {/* ─── Account ─── */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-5">
            {t("settings.account.heading")}
          </h2>

          <dl className="space-y-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-white/40">
                {t("settings.account.email")}
              </dt>
              <dd className="mt-1 text-white/90 break-all">{email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-white/40">
                {t("settings.account.name")}
              </dt>
              <dd className="mt-1 text-white/90">
                {name || <span className="text-white/40">{t("settings.account.notSet")}</span>}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-xs text-white/40">{t("settings.account.googleNotice")}</p>
        </section>

        {/* ─── Credits ─── */}
        <section className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t("settings.credits.heading")}
          </h2>
          <div className="flex items-baseline gap-2">
            <Sparkles className="w-5 h-5 self-center text-purple-400" />
            <span className="text-3xl font-bold text-white">{credits}</span>
            <span className="text-white/50">
              {tCount("settings.credits.extractionLeft", credits)}
            </span>
          </div>
          <p className="mt-3 text-sm text-white/50">{t("settings.credits.explanation")}</p>
        </section>

        {/* ─── Danger zone ─── */}
        <section className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            {t("settings.danger.heading")}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            {t("settings.danger.explanation")}
          </p>

          <div className="mt-5">
            <DeleteAccountDialog />
          </div>

          <p className="mt-5 text-xs text-white/40">
            {t("settings.danger.privacyPrefix")}{" "}
            <Link
              href="/privacy"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              {t("settings.danger.privacyLink")}
            </Link>{" "}
            {t("settings.danger.privacySuffix")}
          </p>
        </section>
      </div>
    </main>
  );
}
