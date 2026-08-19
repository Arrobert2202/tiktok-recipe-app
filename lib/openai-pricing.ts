/**
 * OpenAI cost estimation for a single extraction.
 *
 * Prices are a snapshot, not a live lookup — OpenAI doesn't expose per-request
 * cost. Rechecked and correct as of 19 August 2026:
 *   - gpt-4o-mini: $0.15 / 1M input tokens, $0.60 / 1M output tokens
 *   - whisper-1:   $0.006 / minute of audio ($0.0001/sec)
 * When these change, update the constants below — jobs already completed
 * keep whatever cost was computed at the time (see trigger/extraction-job.ts),
 * so historical figures stay accurate to what was actually billed rather than
 * drifting to whatever the constants say today.
 *
 * Stored and returned in micro-dollars (millionths of a dollar) throughout —
 * an integer column avoids the float-rounding drift a fractional-cent
 * DECIMAL/REAL type invites at these tiny per-request amounts.
 */

const GPT4O_MINI_INPUT_MICROS_PER_TOKEN = 0.15;
const GPT4O_MINI_OUTPUT_MICROS_PER_TOKEN = 0.6;
const WHISPER_MICROS_PER_SECOND = 100; // $0.006/min / 60 = $0.0001/sec = 100 micro-dollars/sec

export interface ExtractionUsage {
  promptTokens?: number;
  completionTokens?: number;
  audioSeconds?: number;
}

/**
 * Estimated cost of one extraction, in micro-dollars. Covers OpenAI API spend
 * only (gpt-4o-mini parse + whisper-1 transcription when audio was actually
 * transcribed) — not yt-dlp/Trigger.dev compute, Vercel, or any other
 * infrastructure overhead, so this is a floor on true per-extraction cost,
 * not the whole of it.
 */
export function estimateCostMicros(usage: ExtractionUsage): number {
  const promptCost = (usage.promptTokens ?? 0) * GPT4O_MINI_INPUT_MICROS_PER_TOKEN;
  const completionCost = (usage.completionTokens ?? 0) * GPT4O_MINI_OUTPUT_MICROS_PER_TOKEN;
  const audioCost = (usage.audioSeconds ?? 0) * WHISPER_MICROS_PER_SECOND;
  return Math.round(promptCost + completionCost + audioCost);
}

export function microsToDollars(micros: number): number {
  return micros / 1_000_000;
}
