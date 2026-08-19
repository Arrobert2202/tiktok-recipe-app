"use client";

import { useState, useTransition } from "react";
import { confirmCreatorAction } from "@/actions/creator";

interface CreatorConfirmButtonProps {
  token: string;
  handle: string;
  action: "opt_out" | "reverse";
}

/**
 * The actual mutation only runs from here — a click — not from the verify
 * page's initial server render. Email clients and security scanners
 * routinely pre-fetch every link in incoming mail, which would silently
 * burn a one-click token before the creator ever opens the message if the
 * GET itself confirmed anything.
 */
export function CreatorConfirmButton({ token, handle, action }: CreatorConfirmButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const outcome = await confirmCreatorAction(token);
      if (outcome.success) {
        setResult({
          success: true,
          message:
            outcome.action === "opt_out"
              ? `@${outcome.handle}'s videos are now excluded from recipe extraction.`
              : `@${outcome.handle}'s opt-out has been reversed — public extraction is restored.`,
        });
      } else {
        setResult({ success: false, message: outcome.error });
      }
    });
  }

  if (result) {
    return (
      <div
        className={`rounded-xl border p-4 text-center ${
          result.success
            ? "border-green-500/20 bg-green-500/10 text-green-400"
            : "border-red-500/20 bg-red-500/10 text-red-400"
        }`}
      >
        <p className="text-sm font-medium">{result.message}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={isPending}
      className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 ${
        action === "opt_out"
          ? "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-500/25 focus:ring-red-500/50"
          : "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-purple-500/25 focus:ring-purple-500/50"
      }`}
    >
      {isPending
        ? "Confirming..."
        : action === "opt_out"
          ? `Confirm opt-out for @${handle}`
          : `Confirm reversal for @${handle}`}
    </button>
  );
}
