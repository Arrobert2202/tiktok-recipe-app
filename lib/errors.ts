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
