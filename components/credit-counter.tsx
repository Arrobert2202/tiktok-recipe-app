"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Crown } from "lucide-react";
import { useCredits } from "@/lib/use-credits";
import { PaywallModal } from "@/components/paywall-modal";
import { useLanguage } from "@/lib/use-language";

export function CreditCounter() {
  const { t } = useLanguage();
  const { credits, loading, isSyncing } = useCredits();
  const [showPaywall, setShowPaywall] = useState(false);

  if (loading || credits === null) {
    return <div className="w-24 h-7 rounded-lg bg-white/5 animate-pulse" />;
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white/50">
        <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
        <span>{t("account.credits.updatingBalance")}</span>
      </div>
    );
  }

  if (credits <= 0) {
    return (
      <>
        <button
          onClick={() => setShowPaywall(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg px-3 py-1 text-sm font-medium text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 transition-all animate-pulse"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>{t("account.credits.upgrade")}</span>
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
      <span>
        {credits} {t("account.credits.freeSuffix")}
      </span>
    </motion.div>
  );
}
