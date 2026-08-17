/**
 * ASR (Automatic Speech Recognition) transcription fallback strategy.
 *
 * TODO: In a full implementation, this would:
 * 1. Extract audio from the TikTok video
 * 2. Send the audio to an ASR service (Whisper API or Deepgram)
 * 3. Return the transcription text
 *
 * For MVP, this is a placeholder that always returns null.
 * The real implementation requires audio extraction capabilities
 * and integration with an ASR service like OpenAI Whisper or Deepgram.
 *
 * Timeout: 60 seconds.
 */

import type { StrategyResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ASR_TIMEOUT_MS = 60_000;

/**
 * Attempts to extract recipe text via audio transcription (ASR).
 *
 * Currently a placeholder for MVP — always returns null.
 */
export async function tryAsrTranscription(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _canonicalUrl: string
): Promise<StrategyResult | null> {
  // TODO: Implement ASR transcription extraction
  // 1. Extract audio from TikTok video (via yt-dlp or similar)
  // 2. Send audio to ASR service with 60s timeout via AbortController
  // 3. Check hasRecipeContent(transcription) before returning
  // 4. Return { text: transcription, strategy: "asr", durationMs } on success
  return null;
}
