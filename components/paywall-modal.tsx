"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Crown, Sparkles, Loader2 } from "lucide-react";
import { createCheckoutSession } from "@/actions/billing";
import { CREDIT_PACKS } from "@/lib/credit-packs";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURES = [
  "1 credit = 1 recipe extraction",
  "Full audio transcription (AI-powered)",
  "Tips & Tricks from chef audio",
  "Upload video for maximum accuracy",
  "Credits never expire",
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pricePerCredit(pack: (typeof CREDIT_PACKS)[number]): string {
  return `${(pack.priceCents / pack.credits / 100).toFixed(2)}/credit`;
}

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleBuy(packId: string) {
    setError(null);
    setPendingPackId(packId);
    startTransition(async () => {
      const result = await createCheckoutSession(packId);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError(result.error ?? "Something went wrong. Please try again.");
      setPendingPackId(null);
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop with blur */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#12121f] shadow-2xl"
        >
          {/* Ambient glow effect */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-purple-500/20 blur-[80px]" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-pink-500/20 blur-[80px]" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/5 p-2 text-white/50 hover:bg-white/10 hover:text-white transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="relative px-8 pt-10 pb-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-2 rounded-2xl border border-purple-500/20"
                />
              </div>
            </div>

            {/* Headline */}
            <h2 className="text-2xl font-bold text-center text-white mb-2">
              Buy credits
            </h2>
            <p className="text-center text-white/50 mb-8">
              You&apos;ve used your free credits. Grab a pack to keep extracting.
            </p>

            {error && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Credit packs */}
            <div className="space-y-3 mb-8">
              {CREDIT_PACKS.map((pack, index) => {
                const isBest = index === CREDIT_PACKS.length - 1;
                const isThisPending = isPending && pendingPackId === pack.id;
                return (
                  <button
                    key={pack.id}
                    onClick={() => handleBuy(pack.id)}
                    disabled={isPending}
                    className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left transition-all disabled:opacity-50 ${
                      isBest
                        ? "border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/15"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{pack.label}</span>
                        {isBest && (
                          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-300">
                            Best value
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white/40">{pricePerCredit(pack)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">
                        {formatPrice(pack.priceCents)}
                      </span>
                      {isThisPending && <Loader2 className="w-4 h-4 animate-spin text-white/50" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20">
                    <Check className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="text-sm text-white/70">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Trust signals */}
            <p className="text-center text-xs text-white/30 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Secure payment via Stripe &middot; No subscription &middot; Instant credit
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
