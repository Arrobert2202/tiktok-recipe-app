"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChefHat, ArrowRight } from "lucide-react";
import { submitTikTokUrl, submitWithDataFusion, type SubmitResult } from "@/actions/extraction";
import { VideoDropzone } from "@/components/video-dropzone";
import { PaywallModal } from "@/components/paywall-modal";
import { useLanguage } from "@/lib/use-language";
import { validateTikTokUrl } from "@/lib/url";

const LOADING_STAGES = [
  { text: "Fetching video info...", icon: "🔍" },
  { text: "Transcribing audio...", icon: "🎙️" },
  { text: "Extracting recipe with AI...", icon: "🧠" },
  { text: "Plating the dish...", icon: "🍽️" },
];

const LOADING_STAGES_WITH_TRANSCRIPT = [
  { text: "Transcribing audio...", icon: "🎙️" },
  { text: "Analyzing video caption...", icon: "🔍" },
  { text: "Fusing data sources...", icon: "🧬" },
  { text: "Plating the dish...", icon: "🍽️" },
];

/** Same wording the server action returns, so one bad link reads the same either way. */
const INVALID_URL_MESSAGE = "Please enter a valid TikTok video URL";

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, ready: languageReady } = useLanguage();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  /** One auto-extraction per visit; strict mode double-invokes effects in dev. */
  const autoSubmittedRef = useRef(false);

  const handleTranscriptReady = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  const stages = transcript ? LOADING_STAGES_WITH_TRANSCRIPT : LOADING_STAGES;

  const pollForCompletion = useCallback(
    (id: string) => {
      const poll = async () => {
        try {
          const res = await fetch(`/api/extraction/status/${id}`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.status === "completed" && data.resultRecipeId) {
            router.push(`/recipe/${data.resultRecipeId}`);
            return;
          }
          if (data.status === "failed") {
            setError(data.error?.message ?? "Extraction failed");
            setIsLoading(false);
            return;
          }
          if (data.status === "timed_out") {
            setError("Extraction timed out. Try again later.");
            setIsLoading(false);
            return;
          }
          // Still processing - poll again
          setTimeout(poll, 3000);
        } catch {
          setTimeout(poll, 5000);
        }
      };
      poll();
    },
    [router]
  );

  const runExtraction = useCallback(
    async (rawUrl: string) => {
      setError(null);
      const trimmed = rawUrl.trim();
      if (!trimmed) {
        setError("Paste a TikTok video URL to get started");
        return;
      }

      setIsLoading(true);
      setLoadingStage(0);

      const activeStages = transcript
        ? LOADING_STAGES_WITH_TRANSCRIPT
        : LOADING_STAGES;

      // Animate through stages
      const stageInterval = setInterval(() => {
        setLoadingStage((prev) => Math.min(prev + 1, activeStages.length - 1));
      }, 2000);

      try {
        if (transcript) {
          // Data Fusion path: caption + transcript
          const result = await submitWithDataFusion(trimmed, transcript, language);
          clearInterval(stageInterval);

          if ("error" in result) {
            if (result.error.code === "INSUFFICIENT_CREDITS") {
              setShowPaywall(true);
              setIsLoading(false);
            } else {
              setError(result.error.message);
              setIsLoading(false);
            }
            return;
          }

          router.push(`/r/${result.recipe.slug}`);
        } else {
          // Original path: URL only
          const result: SubmitResult = await submitTikTokUrl(trimmed, language);
          clearInterval(stageInterval);

          if ("error" in result) {
            if (result.error.code === "INSUFFICIENT_CREDITS") {
              setShowPaywall(true);
              setIsLoading(false);
            } else {
              setError(result.error.message);
              setIsLoading(false);
            }
            return;
          }

          if ("recipe" in result) {
            router.push(`/r/${result.recipe.slug}`);
            return;
          }

          // Job started - start polling
          pollForCompletion(result.jobId);
        }
      } catch {
        clearInterval(stageInterval);
        setError("Something went wrong. Please try again.");
        setIsLoading(false);
      }
    },
    [transcript, language, router, pollForCompletion]
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
      setError(INVALID_URL_MESSAGE);
      return;
    }

    void runExtraction(sharedUrl);
  }, [searchParams, runExtraction, languageReady]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runExtraction(url);
  }

  return (
    <main className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 overflow-hidden">
      {/* Floating decorative elements */}
      <motion.div
        className="absolute top-20 left-10 text-6xl opacity-30"
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, type: "tween", ease: "easeInOut" }}
      >
        🍳
      </motion.div>
      <motion.div
        className="absolute top-32 right-16 text-5xl opacity-25"
        animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 7, repeat: Infinity, type: "tween", ease: "easeInOut", delay: 1 }}
      >
        🥘
      </motion.div>
      <motion.div
        className="absolute bottom-32 left-20 text-5xl opacity-25"
        animate={{ y: [0, -15, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, type: "tween", ease: "easeInOut", delay: 2 }}
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
          className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 border border-purple-500/30 backdrop-blur-sm px-4 py-1.5 mb-6"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">AI-Powered Recipe Extraction</span>
        </motion.div>

        {/* Hero headline with gradient text */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            TikTok recipes,
          </span>
          <br />
          <span className="text-white">beautifully extracted.</span>
        </h1>

        <p className="text-lg sm:text-xl text-white/50 mb-12 max-w-lg mx-auto leading-relaxed">
          Paste any TikTok cooking video. Our AI extracts ingredients, steps, and serves them up — ready to cook.
        </p>

        {/* Glassmorphic search bar */}
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
              <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl p-2 transition-all hover:border-purple-500/30 hover:shadow-purple-500/10 focus-within:border-purple-500/40 focus-within:shadow-purple-500/10">
                <div className="flex items-center gap-3">
                  <div className="pl-4">
                    <ChefHat className="w-6 h-6 text-white/40" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setError(null); }}
                    placeholder="Paste a TikTok video URL..."
                    className="flex-1 bg-transparent text-lg text-white placeholder:text-white/30 focus:outline-none py-4"
                    aria-label="TikTok video URL"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold px-6 py-3.5 rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-95"
                  >
                    Extract
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Video Dropzone */}
              <VideoDropzone
                onTranscriptReady={handleTranscriptReady}
                disabled={isLoading}
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 text-sm text-red-400 font-medium"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </motion.form>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-3xl p-10"
            >
              <div className="space-y-6">
                {stages.map((stage, index) => (
                  <motion.div
                    key={stage.text}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: index <= loadingStage ? 1 : 0.3,
                      x: 0,
                    }}
                    transition={{ delay: index * 0.3, duration: 0.5 }}
                    className="flex items-center gap-4"
                  >
                    <motion.span
                      className="text-3xl"
                      animate={index === loadingStage ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                      transition={{ duration: 1.5, repeat: Infinity, type: "tween", ease: "easeInOut" }}
                    >
                      {stage.icon}
                    </motion.span>
                    <span className={`text-lg font-medium ${
                      index <= loadingStage ? "text-white" : "text-white/30"
                    }`}>
                      {stage.text}
                    </span>
                    {index < loadingStage && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-green-400 text-xl"
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

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mt-8 text-sm text-white/30"
        >
          Works with any TikTok cooking video &middot; Free to use
        </motion.p>
      </motion.div>

      {/* Paywall Modal */}
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </main>
  );
}

/**
 * Static stand-in while search params resolve. Boxes match the real hero —
 * badge, headline, subhead, input — so nothing jumps on swap.
 */
function HomeHeroSkeleton() {
  return (
    <main className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 overflow-hidden">
      <div className="w-full max-w-2xl text-center" aria-hidden="true">
        <div className="mx-auto mb-6 h-8 w-64 rounded-full bg-white/5" />
        <div className="mb-4 h-14 w-full rounded-2xl bg-white/5" />
        <div className="mx-auto mb-10 h-14 w-4/5 rounded-2xl bg-white/5" />
        <div className="mx-auto mb-12 h-5 w-2/3 rounded-lg bg-white/5" />
        <div className="h-20 w-full rounded-2xl bg-white/10" />
      </div>
    </main>
  );
}

/**
 * `useSearchParams` opts a client component out of static prerendering unless a
 * Suspense boundary sits above it. The boundary lives here rather than in the
 * route so the hero stays drop-in wherever it is rendered.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeHeroSkeleton />}>
      <HomePageInner />
    </Suspense>
  );
}
