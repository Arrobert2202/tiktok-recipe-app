/**
 * Extraction ladder orchestrator.
 *
 * Runs extraction strategies in sequence (oembed → native captions → ASR),
 * recording each attempt. Returns the first successful result or throws
 * ExtractionFailedError if all strategies fail.
 */

import type { ExtractionStrategy, StrategyAttempt, ExtractionStage } from "@/lib/types";
import { ExtractionFailedError } from "@/lib/errors";
import type { StrategyResult, StrategyFn } from "./types";
import { tryOembedCaption } from "./oembed";
import { tryNativeCaptions } from "./native-captions";
import { tryAsrTranscription } from "./asr";

export type { StrategyResult, OembedMetadata } from "./types";
export { fetchOembedMetadata } from "./oembed";

interface StrategyEntry {
  fn: StrategyFn;
  name: ExtractionStrategy;
  stage: ExtractionStage;
}

const STRATEGIES: StrategyEntry[] = [
  { fn: tryOembedCaption, name: "oembed_caption", stage: "oembed" },
  { fn: tryNativeCaptions, name: "native_captions", stage: "native_captions" },
  { fn: tryAsrTranscription, name: "asr", stage: "asr" },
];

export interface ExtractionLadderResult {
  text: string;
  strategy: ExtractionStrategy;
  attempts: StrategyAttempt[];
}

/**
 * Runs the extraction ladder: tries each strategy in order (cheapest first),
 * records all attempts, and returns the first successful extraction.
 *
 * @param canonicalUrl - The canonical TikTok video URL
 * @param jobId - The extraction job ID (for logging/tracking)
 * @param updateStage - Optional callback to update the job's current extraction stage
 * @throws ExtractionFailedError if all strategies fail
 */
export async function runExtractionLadder(
  canonicalUrl: string,
  jobId: string,
  updateStage?: (stage: ExtractionStage) => Promise<void>
): Promise<ExtractionLadderResult> {
  const attempts: StrategyAttempt[] = [];

  for (const { fn, name, stage } of STRATEGIES) {
    if (updateStage) {
      await updateStage(stage);
    }

    const start = Date.now();
    let result: StrategyResult | null = null;
    let error: string | undefined;

    try {
      result = await fn(canonicalUrl);
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error";
    }

    const durationMs = Date.now() - start;

    attempts.push({
      strategy: name,
      success: !!result,
      durationMs: result?.durationMs ?? durationMs,
      error,
    });

    if (result) {
      return { text: result.text, strategy: result.strategy, attempts };
    }
  }

  throw new ExtractionFailedError(attempts);
}
