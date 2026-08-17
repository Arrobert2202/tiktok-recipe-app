import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { validRecipe } from "./generators/recipe.gen";
import { recipeSchema } from "@/lib/schemas";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mocked-model"),
}));

import { parseRecipeFromText } from "@/lib/recipe-parser";
import { generateObject } from "ai";

const mockedGenerateObject = vi.mocked(generateObject);

/**
 * Property 3: Parser Output Structural Validity
 *
 * Since calling a real LLM is not feasible in tests, this test validates that
 * the Zod schema enforcement works correctly. We mock `generateObject` to return
 * generated recipe objects, then verify the output conforms to the schema.
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */
describe("Property: Parser Output Structural Validity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("output has title 1-200 chars, ≥1 ingredient with non-empty name, ≥1 step", async () => {
    await fc.assert(
      fc.asyncProperty(validRecipe, async (recipe) => {
        mockedGenerateObject.mockResolvedValue({
          object: recipe,
        } as any);

        const result = await parseRecipeFromText("some transcript text");

        // Title: 1-200 characters
        expect(result.title.length).toBeGreaterThanOrEqual(1);
        expect(result.title.length).toBeLessThanOrEqual(200);

        // At least 1 ingredient with non-empty name
        expect(result.ingredients.length).toBeGreaterThanOrEqual(1);
        for (const ingredient of result.ingredients) {
          expect(ingredient.name.length).toBeGreaterThanOrEqual(1);
        }

        // At least 1 step
        expect(result.steps.length).toBeGreaterThanOrEqual(1);
        for (const step of result.steps) {
          expect(step.length).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("all output conforms to the Zod recipeSchema", async () => {
    await fc.assert(
      fc.asyncProperty(validRecipe, async (recipe) => {
        mockedGenerateObject.mockResolvedValue({
          object: recipe,
        } as any);

        const result = await parseRecipeFromText("some transcript text");

        // Validate against the Zod schema directly
        const parseResult = recipeSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
