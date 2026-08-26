"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChefHat,
  ArrowRight,
  Lightbulb,
  Flame,
  ShoppingBasket,
  Heart,
} from "lucide-react";
import { submitAnonymousUrl } from "@/actions/extraction";
import { useLanguage } from "@/lib/use-language";
import { validateTikTokUrl } from "@/lib/url";
import type { TranslationKey } from "@/lib/translations";

/** Caption-only pipeline, so the staged copy talks about reading, not listening. */
const LOADING_STAGES: { textKey: TranslationKey; icon: string }[] = [
  { textKey: "landing.loading.caption", icon: "📖" },
  { textKey: "landing.loading.extracting", icon: "🧠" },
  { textKey: "landing.loading.plating", icon: "🍽️" },
];

/** Error codes where the right response is an invitation to sign in, not a wall. */
const CONVERSION_CODES = new Set(["ANON_LIMIT_REACHED", "NO_CAPTION", "THIN_CAPTION"]);

const WHAT_YOU_GET: {
  icon: typeof Lightbulb;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  accent: string;
  iconColor: string;
}[] = [
  {
    icon: Lightbulb,
    titleKey: "landing.whatYouGet.tips.title",
    bodyKey: "landing.whatYouGet.tips.body",
    accent: "from-amber-400/20 to-orange-500/10",
    iconColor: "text-amber-300",
  },
  {
    icon: Flame,
    titleKey: "landing.whatYouGet.cookMode.title",
    bodyKey: "landing.whatYouGet.cookMode.body",
    accent: "from-purple-400/20 to-pink-500/10",
    iconColor: "text-pink-300",
  },
  {
    icon: ShoppingBasket,
    titleKey: "landing.whatYouGet.shoppingLists.title",
    bodyKey: "landing.whatYouGet.shoppingLists.body",
    accent: "from-emerald-400/20 to-teal-500/10",
    iconColor: "text-emerald-300",
  },
];

const HOW_IT_WORKS: { step: string; titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  {
    step: "1",
    titleKey: "landing.howItWorks.step1.title",
    bodyKey: "landing.howItWorks.step1.body",
  },
  {
    step: "2",
    titleKey: "landing.howItWorks.step2.title",
    bodyKey: "landing.howItWorks.step2.body",
  },
  {
    step: "3",
    titleKey: "landing.howItWorks.step3.title",
    bodyKey: "landing.howItWorks.step3.body",
  },
];

/** Google mark, matching the sign-in page button. */
function GoogleMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GoogleCta() {
  const { t } = useLanguage();
  return (
    <Link
      href="/auth/signin"
      className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-base font-semibold text-gray-900 shadow-xl shadow-black/20 transition-colors hover:bg-white/90"
    >
      <GoogleMark />
      <span>{t("landing.googleCta")}</span>
    </Link>
  );
}

function LandingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, ready: languageReady, t } = useLanguage();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  /** One auto-extraction per visit; strict mode double-invokes effects in dev. */
  const autoSubmittedRef = useRef(false);

  const runExtraction = useCallback(
    async (rawUrl: string) => {
      setError(null);

      const trimmed = rawUrl.trim();
      if (!trimmed) {
        setError({ code: "EMPTY", message: t("landing.error.empty") });
        return;
      }

      setIsLoading(true);
      setLoadingStage(0);

      const stageInterval = setInterval(() => {
        setLoadingStage((prev) => Math.min(prev + 1, LOADING_STAGES.length - 1));
      }, 2000);

      try {
        const result = await submitAnonymousUrl(trimmed, language);
        clearInterval(stageInterval);

        if ("error" in result) {
          setError({ code: result.error.code, message: result.error.message });
          setIsLoading(false);
          return;
        }

        router.push(`/r/${result.recipe.slug}`);
      } catch {
        clearInterval(stageInterval);
        setError({ code: "UNKNOWN", message: t("landing.error.unknown") });
        setIsLoading(false);
      }
    },
    [language, router, t]
  );

  /**
   * Share-sheet entry point. `/share` redirects here with `?url=`, as does the
   * iOS Shortcut, so extraction starts on its own and the visitor lands
   * mid-progress rather than on a pre-filled form they still have to submit.
   *
   * A link that arrives malformed still fills the input and surfaces the same
   * inline error a manual paste would, rather than being dropped in silence.
   *
   * Held until `languageReady`: the language preference lives in localStorage
   * and is only readable after hydration, so firing on the first render would
   * extract in the "en" placeholder instead of the user's actual language. The
   * effect re-runs once the preference settles, and `autoSubmittedRef` is what
   * keeps that re-run — plus the one from `runExtraction` changing identity
   * with `language` — from starting a second extraction.
   */
  useEffect(() => {
    if (!languageReady) return;
    if (autoSubmittedRef.current) return;

    const sharedUrl = searchParams.get("url")?.trim();
    if (!sharedUrl) return;

    autoSubmittedRef.current = true;
    setUrl(sharedUrl);

    if (!validateTikTokUrl(sharedUrl)) {
      setError({ code: "INVALID_URL", message: t("landing.error.invalidUrl") });
      return;
    }

    void runExtraction(sharedUrl);
  }, [searchParams, runExtraction, languageReady, t]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runExtraction(url);
  }

  const isConversionMoment = error !== null && CONVERSION_CODES.has(error.code);

  return (
    <main className="relative flex flex-col items-center overflow-hidden">
      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[calc(100vh-64px)] w-full flex-col items-center justify-center px-6">
        {/* Floating decorative elements */}
        <motion.div
          className="absolute top-20 left-10 text-6xl opacity-30 pointer-events-none"
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, type: "tween", ease: "easeInOut" }}
          aria-hidden="true"
        >
          🍳
        </motion.div>
        <motion.div
          className="absolute top-32 right-16 text-5xl opacity-25 pointer-events-none"
          animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 7, repeat: Infinity, type: "tween", ease: "easeInOut", delay: 1 }}
          aria-hidden="true"
        >
          🥘
        </motion.div>
        <motion.div
          className="absolute bottom-32 left-20 text-5xl opacity-25 pointer-events-none"
          animate={{ y: [0, -15, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, type: "tween", ease: "easeInOut", delay: 2 }}
          aria-hidden="true"
        >
          🍕
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-2xl text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/20 px-4 py-1.5 backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">
              {t("landing.badge")}
            </span>
          </motion.div>

          {/* Headline */}
          <h1 className="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-white">{t("landing.headline.part1")}</span>
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              {t("landing.headline.part2")}
            </span>
            <span className="text-white">{t("landing.headline.part3")}</span>
          </h1>

          <p className="mx-auto mb-12 max-w-lg text-lg leading-relaxed text-white/50 sm:text-xl">
            {t("landing.subheadline")}
          </p>

          {/* URL input / loading */}
          <AnimatePresence mode="wait">
            {!isLoading ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                onSubmit={handleSubmit}
                className="relative"
              >
                <div className="relative rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-xl transition-all hover:border-purple-500/30 hover:shadow-purple-500/10 focus-within:border-purple-500/40 focus-within:shadow-purple-500/10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="hidden pl-4 sm:block">
                      <ChefHat className="h-6 w-6 text-white/40" />
                    </div>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setError(null);
                      }}
                      placeholder={t("landing.urlPlaceholder")}
                      className="flex-1 bg-transparent px-4 py-4 text-lg text-white placeholder:text-white/30 focus:outline-none sm:px-0"
                      aria-label={t("landing.urlInputAriaLabel")}
                    />
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/40 active:scale-95"
                    >
                      {t("landing.extractButton")}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm text-white/40">{t("landing.freeDisclaimer")}</p>

                {error && !isConversionMoment && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 text-sm font-medium text-red-400"
                    role="alert"
                  >
                    {error.message}
                  </motion.p>
                )}

                {error && isConversionMoment && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 rounded-3xl border border-purple-500/20 bg-white/5 p-6 text-left shadow-2xl backdrop-blur-xl sm:p-8"
                    role="alert"
                  >
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1">
                      <Sparkles className="h-3.5 w-3.5 text-purple-300" />
                      <span className="text-xs font-medium text-purple-200">
                        {t("landing.keepGoingFree")}
                      </span>
                    </div>
                    <p className="mb-6 text-lg leading-relaxed text-white">{error.message}</p>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <GoogleCta />
                      <span className="text-sm text-white/40">
                        {t("landing.conversionDisclaimer")}
                      </span>
                    </div>
                  </motion.div>
                )}
              </motion.form>
            ) : (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl"
              >
                <div className="space-y-6">
                  {LOADING_STAGES.map((stage, index) => (
                    <motion.div
                      key={stage.textKey}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: index <= loadingStage ? 1 : 0.3, x: 0 }}
                      transition={{ delay: index * 0.3, duration: 0.5 }}
                      className="flex items-center gap-4"
                    >
                      <motion.span
                        className="text-3xl"
                        animate={
                          index === loadingStage ? { scale: [1, 1.2, 1] } : { scale: 1 }
                        }
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          type: "tween",
                          ease: "easeInOut",
                        }}
                      >
                        {stage.icon}
                      </motion.span>
                      <span
                        className={`text-lg font-medium ${
                          index <= loadingStage ? "text-white" : "text-white/30"
                        }`}
                      >
                        {t(stage.textKey)}
                      </span>
                      {index < loadingStage && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-xl text-green-400"
                        >
                          ✓
                        </motion.span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ─── What you get ──────────────────────────────────────────────────── */}
      <section className="w-full max-w-6xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            {t("landing.whatYouGet.heading")}
          </h2>
          <p className="mx-auto max-w-xl text-lg text-white/50">
            {t("landing.whatYouGet.subhead")}
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {WHAT_YOU_GET.map((card, index) => (
            <motion.div
              key={card.titleKey}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-colors hover:border-white/20"
            >
              <div
                className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent}`}
              >
                <card.icon className={`h-6 w-6 ${card.iconColor}`} />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">{t(card.titleKey)}</h3>
              <p className="leading-relaxed text-white/50">{t(card.bodyKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="w-full max-w-5xl px-6 py-24">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center text-3xl font-bold text-white sm:text-4xl"
        >
          {t("landing.howItWorks.heading")}
        </motion.h2>

        <div className="grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="text-center"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 text-xl font-bold text-white shadow-lg shadow-purple-500/25">
                {item.step}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{t(item.titleKey)}</h3>
              <p className="leading-relaxed text-white/50">{t(item.bodyKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Creator-friendly ─────────────────────────────────────────────── */}
      <section className="w-full max-w-4xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl sm:p-12"
        >
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400/20 to-purple-500/10">
            <Heart className="h-6 w-6 text-pink-300" />
          </div>
          <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
            {t("landing.creatorFriendly.heading")}
          </h2>
          <p className="mb-4 text-lg leading-relaxed text-white/60">
            {t("landing.creatorFriendly.body1")}
          </p>
          <p className="text-lg leading-relaxed text-white/60">
            {t("landing.creatorFriendly.body2.prefix")}
            <Link
              href="/creators"
              className="font-medium text-purple-300 underline decoration-purple-300/40 underline-offset-4 transition-colors hover:text-purple-200"
            >
              /creators
            </Link>
            {t("landing.creatorFriendly.body2.suffix")}
          </p>
        </motion.div>
      </section>

      {/* ─── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="w-full max-w-3xl px-6 pb-28 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-purple-500/20 bg-white/5 p-10 text-center shadow-2xl backdrop-blur-xl sm:p-14"
        >
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            {t("landing.closingCta.heading")}
          </h2>
          <p className="mx-auto mb-8 max-w-md text-lg text-white/50">
            {t("landing.closingCta.body")}
          </p>
          <div className="flex justify-center">
            <GoogleCta />
          </div>
        </motion.div>
      </section>
    </main>
  );
}

/**
 * Static stand-in for the hero while search params resolve. Boxes match the
 * real hero's rhythm — badge, headline, subhead, input — so the swap doesn't
 * shift anything under the user's thumb.
 */
function LandingHeroSkeleton() {
  return (
    <main className="relative flex flex-col items-center overflow-hidden">
      <section className="relative flex min-h-[calc(100vh-64px)] w-full flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center" aria-hidden="true">
          <div className="mx-auto mb-6 h-8 w-64 rounded-full bg-white/5" />
          <div className="mb-4 h-14 w-full rounded-2xl bg-white/5" />
          <div className="mx-auto mb-10 h-14 w-4/5 rounded-2xl bg-white/5" />
          <div className="mx-auto mb-12 h-5 w-2/3 rounded-lg bg-white/5" />
          <div className="h-20 w-full rounded-2xl bg-white/10" />
        </div>
      </section>
    </main>
  );
}

/**
 * `useSearchParams` opts a client component out of static prerendering unless a
 * Suspense boundary sits above it. The boundary lives here rather than in the
 * route so the hero stays drop-in wherever it is rendered.
 */
export default function LandingPage() {
  return (
    <Suspense fallback={<LandingHeroSkeleton />}>
      <LandingPageInner />
    </Suspense>
  );
}
