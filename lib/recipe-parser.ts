import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { recipeSchema } from "./schemas";
import { TextTooLongError, RecipeParseError } from "./errors";
import { getLanguageNameForCode } from "./languages";
import type { z } from "zod";

export type RecipeOutput = z.infer<typeof recipeSchema>;

export interface RecipeParseResult {
  recipe: RecipeOutput;
  /** For cost tracking (lib/openai-pricing.ts) — undefined if the provider didn't report it. */
  usage: { promptTokens?: number; completionTokens?: number };
}

const MAX_INPUT_LENGTH = 50_000;

interface ParseRecipeInput {
  captionText?: string;
  transcriptText?: string;
  language?: string;
}

/**
 * Parses recipe data from combined sources using the Data Fusion model.
 * Accepts caption text (from oEmbed) and/or transcript text (from Whisper).
 * Feeds both to the LLM for maximum extraction accuracy.
 */
export async function parseRecipeFromText(
  textOrInput: string | ParseRecipeInput
): Promise<RecipeParseResult> {
  // Support legacy single-string input
  let captionText: string | undefined;
  let transcriptText: string | undefined;
  let language: string | undefined;

  if (typeof textOrInput === "string") {
    captionText = textOrInput;
  } else {
    captionText = textOrInput.captionText;
    transcriptText = textOrInput.transcriptText;
    language = textOrInput.language;
  }

  const languageName = getLanguageNameForCode(language ?? "en");

  const combinedText = [captionText, transcriptText].filter(Boolean).join("\n\n");

  if (!combinedText) {
    throw new RecipeParseError("No text provided for parsing", "");
  }

  if (combinedText.length > MAX_INPUT_LENGTH) {
    throw new TextTooLongError(combinedText.length);
  }

  // Build the prompt based on what sources are available
  let sourceDescription: string;
  let sourceContent: string;

  if (captionText && transcriptText) {
    sourceDescription = "You will receive two texts: a VIDEO CAPTION (usually contains ingredient lists and quantities) and an AUDIO TRANSCRIPT (usually contains step-by-step instructions, timing, temperatures, and pro-tips the chef mentions while cooking). Merge ALL information from both sources to create the most complete recipe possible.";
    sourceContent = `=== VIDEO CAPTION ===\n${captionText}\n\n=== AUDIO TRANSCRIPT ===\n${transcriptText}`;
  } else if (transcriptText) {
    sourceDescription = "You will receive an audio transcript from a TikTok cooking video. The chef is speaking their recipe aloud, including ingredients, steps, and tips.";
    sourceContent = `=== AUDIO TRANSCRIPT ===\n${transcriptText}`;
  } else {
    sourceDescription = "You will receive a TikTok video caption. Extract the recipe from it.";
    sourceContent = `=== VIDEO CAPTION ===\n${captionText}`;
  }

  try {
    const { object, usage } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: recipeSchema,
      prompt: `You are an expert culinary AI specializing in extracting structured recipes from TikTok videos.

${sourceDescription}

Instructions:
- Extract a clear, descriptive recipe title (max 200 characters)
- Extract ALL ingredients with precise quantities and units. The caption often has the ingredient list. The transcript may mention additional ingredients or clarify amounts.
- For quantity and unit: if a precise measurement is not available, use an empty string "". Never omit these fields.
- Extract preparation steps in chronological order. Combine information from both sources — the caption may list brief steps while the transcript has detailed explanations.
- Extract Tips & Tricks: chef secrets, resting times, temperature tips, substitution suggestions, "the key is to...", "make sure you...", timing advice, or any pro-tips the chef mentions that improve the outcome. These are often ONLY in the audio transcript.
- For tipsAndTricks: always include this field. Use an empty array [] if no tips are found.

For informal language (slang, "eyeball it", "a good amount"), interpret as best you can into structured data.
- IMPORTANT: Output the recipe in ${languageName}. Translate all ingredient names, steps, and tips into ${languageName}.

${sourceContent}`,
    });

    return {
      recipe: object,
      usage: { promptTokens: usage.inputTokens, completionTokens: usage.outputTokens },
    };
  } catch (error) {
    if (error instanceof TextTooLongError) {
      throw error;
    }
    // Log the actual error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Recipe Parser] LLM parsing failed:", errorMessage);
    console.error("[Recipe Parser] Input text (first 500 chars):", combinedText.slice(0, 500));
    
    throw new RecipeParseError(
      `Could not extract recipe: ${errorMessage}`,
      combinedText
    );
  }
}
