/**
 * Core TypeScript types for the TikTok Recipe App.
 */

export interface Ingredient {
  name: string;
  quantity: string;  // empty string if unknown
  unit: string;      // empty string if unknown
}

export type ExtractionStrategy = "cache" | "oembed_caption" | "native_captions" | "asr" | "data_fusion";

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  tipsAndTricks: string[];
  sourceUrl: string;
  creatorHandle: string;
  creatorDisplayName?: string;
  creatorProfileUrl: string;
  thumbnailUrl?: string;
  extractionStrategy: ExtractionStrategy;
  extractionDurationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ExtractionStatus = "pending" | "processing" | "completed" | "failed" | "timed_out";

export type ExtractionStage =
  | "cache_lookup"
  | "oembed"
  | "asr"
  | "llm_parse"
  | "complete";

export interface StrategyAttempt {
  strategy: ExtractionStrategy;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface ExtractionError {
  code: string;
  message: string;
  strategiesAttempted: StrategyAttempt[];
}

export interface ExtractionJob {
  id: string;
  url: string;
  canonicalUrl: string;
  userId: string;
  status: ExtractionStatus;
  currentStage: ExtractionStage;
  strategiesAttempted: StrategyAttempt[];
  result?: Recipe;
  error?: ExtractionError;
  createdAt: Date;
  updatedAt: Date;
}
