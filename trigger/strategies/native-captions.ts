/**
 * Native captions (subtitles) extraction strategy.
 *
 * TODO: In a full implementation, this would:
 * 1. Access TikTok's internal APIs or a third-party service to fetch subtitle tracks
 * 2. Parse VTT/SRT format into plain text
 * 3. Check for recipe content criteria
 *
 * For MVP, this is a placeholder that always returns null.
 * The real implementation requires accessing TikTok's internal caption APIs
 * or integrating a third-party service that provides subtitle track access.
 *
 * Timeout: 15 seconds.
 */

import type { StrategyResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NATIVE_CAPTIONS_TIMEOUT_MS = 15_000;

/**
 * Attempts to extract recipe text from native video captions/subtitles.
 *
 * Currently a placeholder for MVP — always returns null.
 */
export async function tryNativeCaptions(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _canonicalUrl: string
): Promise<StrategyResult | null> {
  // TODO: Implement native captions extraction
  // 1. Fetch subtitle track URLs from TikTok video metadata
  // 2. Download VTT/SRT subtitle file (with 15s timeout via AbortController)
  // 3. Parse VTT/SRT into plain text
  // 4. Check hasRecipeContent(text) before returning
  // 5. Return { text, strategy: "native_captions", durationMs } on success
  return null;
}
