"use client";

import { useState, useTransition } from "react";
import { submitTikTokUrl, type SubmitResult } from "@/actions/extraction";
import type { Recipe } from "@/lib/types";

interface UrlInputProps {
  onJobStarted: (jobId: string) => void;
  onCachedRecipe: (recipe: Recipe) => void;
}

export function UrlInput({ onJobStarted, onCachedRecipe }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Please enter a TikTok video URL");
      return;
    }

    startTransition(async () => {
      const result: SubmitResult = await submitTikTokUrl(trimmedUrl);

      if ("error" in result) {
        setError(result.error.message);
        return;
      }

      if ("recipe" in result) {
        onCachedRecipe(result.recipe);
        return;
      }

      onJobStarted(result.jobId);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a TikTok video URL..."
            disabled={isPending}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="TikTok video URL"
            aria-describedby={error ? "url-error" : undefined}
            aria-invalid={error ? "true" : undefined}
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-purple-600 px-6 py-3 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Extracting...
              </span>
            ) : (
              "Extract Recipe"
            )}
          </button>
        </div>
        {error && (
          <p id="url-error" className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
