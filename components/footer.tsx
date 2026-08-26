"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/use-language";
import type { TranslationKey } from "@/lib/translations";

const LINKS: { href: string; labelKey: TranslationKey }[] = [
  { href: "/install", labelKey: "footer.installApp" },
  { href: "/terms", labelKey: "footer.terms" },
  { href: "/privacy", labelKey: "footer.privacy" },
  { href: "/creators", labelKey: "footer.creators" },
];

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/5 mt-24">
      <div className="mx-auto max-w-5xl px-6 py-12 text-center">
        <nav
          aria-label={t("footer.footerNavLabel")}
          className="flex items-center justify-center gap-6"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-xs text-white/30">{t("footer.tagline")}</p>
      </div>
    </footer>
  );
}
