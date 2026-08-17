import { recipeSchema } from "./schemas";
import { z } from "zod";

/**
 * RecipeData is the shape stored in database JSONB —
 * the parsed recipe content (title, ingredients, steps).
 */
export type RecipeData = z.infer<typeof recipeSchema>;

export type SerializationError = {
  type: "invalid_json" | "schema_violation";
  message: string;
  details?: Record<string, string>;
};

export type DeserializeResult =
  | { success: true; data: RecipeData }
  | { success: false; error: SerializationError };

/**
 * Serializes a RecipeData object to a JSON string.
 */
export function serialize(recipe: RecipeData): string {
  return JSON.stringify(recipe);
}

/**
 * Deserializes a JSON string into a RecipeData object.
 * Validates against the Zod recipe schema on deserialization.
 * Returns a structured error for invalid/malformed JSON or schema violations.
 */
export function deserialize(json: string): DeserializeResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      success: false,
      error: {
        type: "invalid_json",
        message: "Failed to parse JSON: input is not valid JSON",
      },
    };
  }

  const result = recipeSchema.safeParse(parsed);

  if (!result.success) {
    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      details[path || "root"] = issue.message;
    }

    return {
      success: false,
      error: {
        type: "schema_violation",
        message: "JSON does not conform to the recipe schema",
        details,
      },
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
