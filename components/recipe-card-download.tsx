"use client";

import { motion } from "framer-motion";
import { ImageDown } from "lucide-react";

interface RecipeCardDownloadProps {
  slug: string;
}

/**
 * Secondary affordance next to the share button: opens the story-shaped
 * recipe card image in a new tab so it can be saved or screenshotted.
 */
export function RecipeCardDownload({ slug }: RecipeCardDownloadProps) {
  return (
    <motion.button
      type="button"
      onClick={() => window.open(`/api/card/${slug}`, "_blank", "noopener,noreferrer")}
      whileTap={{ scale: 0.96 }}
      aria-label="Save recipe card image (opens in a new tab)"
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/45 hover:text-white/80 hover:bg-white/5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      <ImageDown className="w-4 h-4" />
      Save recipe card
    </motion.button>
  );
}
