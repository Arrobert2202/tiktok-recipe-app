import type { ExtractionStrategy } from "@/lib/types";

/** Caption-only — no audio was transcribed. */
export const QUALITY_TIER_CAPTION = 0;
/** Audio was transcribed and fused with the caption, or captions came straight from the platform. */
export const QUALITY_TIER_FULL = 1;

/**
 * Maps an extraction strategy to the quality tier recipe_cache keys on.
 *
 * Takes `ExtractionStrategy` minus `"cache"` on purpose: this only ever runs
 * on a strategy a fresh extraction actually produced (what's about to be
 * written to `recipes.extractionStrategy`), and "cache" describes how a
 * *request* was satisfied, not how content was produced — it's meaningful
 * inside `StrategyAttempt.strategy`, never as a recipe's own field.
 *
 * Exhaustive over the remaining four values — including "native_captions"
 * and "asr" alone, which nothing writes today — rather than an if/else over
 * just what's written today, so adding a new strategy without deciding its
 * tier is a compile error here instead of a silently-wrong cache entry.
 */
export function getQualityTierForStrategy(
  strategy: Exclude<ExtractionStrategy, "cache">
): number {
  switch (strategy) {
    case "oembed_caption":
      return QUALITY_TIER_CAPTION;
    case "native_captions":
    case "asr":
    case "data_fusion":
      return QUALITY_TIER_FULL;
    default: {
      const exhaustive: never = strategy;
      throw new Error(`Unhandled extraction strategy: ${exhaustive}`);
    }
  }
}
