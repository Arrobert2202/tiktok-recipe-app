"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Crown, Sparkles } from "lucide-react";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRO_FEATURES = [
  "Unlimited recipe extractions",
  "Full audio transcription (AI-powered)",
  "Tips & Tricks from chef audio",
  "Priority processing speed",
  "Cook Mode with wake-lock",
  "Export recipes as PDF",
];

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  if (!isOpen) return null;

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
              Upgrade to Pro
            </h2>
            <p className="text-center text-white/50 mb-8">
              You&apos;ve used your free recipes. Unlock unlimited extractions.
            </p>

            {/* Price card */}
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 mb-6">
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-4xl font-bold text-white">$2.99</span>
                <span className="text-white/50">/month</span>
              </div>
              <p className="text-center text-sm text-white/40">Cancel anytime</p>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20">
                    <Check className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="text-sm text-white/70">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <button
              onClick={() => {
                // TODO: Integrate Stripe Checkout
                alert("Stripe integration coming soon! For now, enjoy exploring the app.");
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-4 px-8 rounded-2xl shadow-2xl shadow-purple-500/30 hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/50 transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5" />
              Subscribe with Stripe
            </button>

            {/* Trust signals */}
            <p className="text-center text-xs text-white/30 mt-4">
              Secure payment via Stripe &middot; Cancel anytime &middot; Instant access
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
