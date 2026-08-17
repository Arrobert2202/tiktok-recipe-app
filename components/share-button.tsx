"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Check } from "lucide-react";

interface ShareButtonProps {
  slug: string;
  title: string;
  variant?: "solid" | "ghost";
}

const COPIED_DURATION_MS = 2000;

const VARIANT_CLASSES: Record<"solid" | "ghost", string> = {
  ghost:
    "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white",
  solid:
    "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/40",
};

/**
 * Share entry point for a recipe.
 *
 * Uses the Web Share sheet when available (mobile), otherwise copies the
 * public /r/{slug} link to the clipboard. Degrades twice more for insecure
 * contexts: execCommand("copy"), then a readonly input the user can copy by
 * hand.
 */
export function ShareButton({ slug, title, variant = "ghost" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    };
  }, []);

  function flashCopied() {
    setCopied(true);
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), COPIED_DURATION_MS);
  }

  async function handleShare() {
    const url = `${window.location.origin}/r/${slug}`;
    setManualUrl(null);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: `Recipe: ${title}`, url });
        return;
      } catch (error) {
        // Dismissing the share sheet is a normal outcome, not a failure.
        if (error instanceof Error && error.name === "AbortError") return;
        // Any other share failure falls through to the clipboard path.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flashCopied();
      return;
    } catch {
      // Clipboard API unavailable (insecure context) or permission denied.
    }

    if (copyViaExecCommand(url)) {
      flashCopied();
      return;
    }

    setManualUrl(url);
  }

  return (
    <div className="inline-flex flex-col items-start">
      <motion.button
        type="button"
        onClick={handleShare}
        whileTap={{ scale: 0.96 }}
        aria-label={copied ? "Link copied" : `Share ${title}`}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 ${VARIANT_CLASSES[variant]}`}
      >
        {copied ? (
          <Check className="w-4 h-4" strokeWidth={2.5} />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        {copied ? "Link copied!" : "Share"}
      </motion.button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Share link copied to clipboard" : ""}
      </span>

      {manualUrl && (
        <input
          readOnly
          value={manualUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Recipe share link — copy manually"
          className="mt-2 w-full min-w-[240px] rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-purple-500/50"
        />
      )}
    </div>
  );
}

/**
 * Last-resort copy for contexts where navigator.clipboard is unavailable.
 * Returns false when the command is unsupported or blocked.
 */
function copyViaExecCommand(url: string): boolean {
  try {
    const input = document.createElement("input");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.top = "-1000px";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, url.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  } catch {
    return false;
  }
}
