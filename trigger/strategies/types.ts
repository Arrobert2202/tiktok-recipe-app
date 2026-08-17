/**
 * Shared types for extraction strategies.
 */

import type { ExtractionStrategy } from "@/lib/types";

export interface StrategyResult {
  text: string;
  strategy: ExtractionStrategy;
  durationMs: number;
}

export interface OembedMetadata {
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string;
}

export type StrategyFn = (canonicalUrl: string) => Promise<StrategyResult | null>;
