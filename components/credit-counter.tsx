"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Crown } from "lucide-react";
import { useCredits } from "@/lib/use-credits";
import { PaywallModal } from "@/components/paywall-modal";

export function CreditCounter() {
  const { credits, loading } = useCredits();
  const [showPaywall, setShowPaywall] = useState(false);

  if (loading || credits === null) {
    return <div className="w-24 h-7 rounded-lg bg-white/5 animate-pulse" />;
  }

  if (credits <= 0) {
    return (
      <>
        <button
          onClick={() => setShowPaywall(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg px-3 py-1 text-sm font-medium text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 transition-all animate-pulse"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Upgrade</span>
        </button>
        <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      </>
    );
  }

  return (
    <motion.div
      key={credits}
      initial={{ scale: 1.2 }}
      animate={{ scale: 1 }}
      className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white/70"
    >
      <Zap className="w-3.5 h-3.5 text-yellow-400" />
      <span>{credits} free</span>
    </motion.div>
  );
}
