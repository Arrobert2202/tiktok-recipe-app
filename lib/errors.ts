export interface AppError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export function createError(
  code: string,
  message: string,
  details?: Record<string, string>
): AppError {
  return { code, message, details };
}

export class TextTooLongError extends Error {
  public readonly code = "TEXT_TOO_LONG";
  public readonly length: number;

  constructor(length: number) {
    super(`Input text exceeds the 50,000 character limit (received ${length} characters)`);
    this.name = "TextTooLongError";
    this.length = length;
  }
}

export class RecipeParseError extends Error {
  public readonly code = "RECIPE_PARSE_FAILED";
  public readonly sourceText: string;

  constructor(reason: string, sourceText: string) {
    super(`Failed to parse recipe: ${reason}`);
    this.name = "RecipeParseError";
    this.sourceText = sourceText;
  }
}

export type VideoUnavailableReason = "private_or_deleted" | "rate_limited" | "unknown";

/**
 * Thrown when a video can't be reached at all — as opposed to RecipeParseError,
 * where we reached it fine and just didn't find a recipe in it. `reason` is
 * best-effort: derived from oEmbed's HTTP status or known yt-dlp stderr
 * patterns, "unknown" when neither gives us anything to go on.
 */
export class VideoUnavailableError extends Error {
  public readonly code = "VIDEO_UNAVAILABLE";
  public readonly reason: VideoUnavailableReason;

  constructor(reason: VideoUnavailableReason, detail: string) {
    super(`Video unavailable (${reason}): ${detail}`);
    this.name = "VideoUnavailableError";
    this.reason = reason;
  }
}

/**
 * User-facing copy for each VideoUnavailableReason — shared by the anonymous,
 * signed-in, and async job failure paths so the wording is consistent no
 * matter which one hits it.
 */
export function videoUnavailableMessage(reason: VideoUnavailableReason): string {
  switch (reason) {
    case "private_or_deleted":
      return "This video is private, deleted, or no longer available. Double-check the link, or try a different video.";
    case "rate_limited":
      return "TikTok is temporarily limiting requests. Please try again in a few minutes.";
    default:
      return "We couldn't reach this video right now. Double-check the link, or try again in a few minutes.";
  }
}

export class ExtractionFailedError extends Error {
  public readonly code = "EXTRACTION_FAILED";
  public readonly strategiesAttempted: Array<{
    strategy: string;
    success: boolean;
    durationMs: number;
    error?: string;
  }>;

  constructor(
    strategiesAttempted: Array<{
      strategy: string;
      success: boolean;
      durationMs: number;
      error?: string;
    }>
  ) {
    const summary = strategiesAttempted
      .map((a) => `${a.strategy}: ${a.error ?? "no result"}`)
      .join(", ");
    super(`All extraction strategies failed: ${summary}`);
    this.name = "ExtractionFailedError";
    this.strategiesAttempted = strategiesAttempted;
  }
}
