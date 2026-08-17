import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  hasRecipeContent,
  RECIPE_VERBS,
  MEASUREMENT_WORDS,
} from "@/lib/recipe-detection";

/**
 * Property 2: Recipe Content Detection
 *
 * Validates: Requirements 2.3
 */
describe("Property: Recipe Content Detection", () => {
  // Generator for random padding text that won't accidentally contain
  // recipe verbs or numeric quantities
  const paddingWord = fc
    .stringMatching(/^[a-z]{3,8}$/)
    .filter(
      (w) =>
        !RECIPE_VERBS.some((v) => w.includes(v)) &&
        !MEASUREMENT_WORDS.some((m) => w.includes(m))
    );

  const paddingText = fc
    .array(paddingWord, { minLength: 0, maxLength: 5 })
    .map((words) => words.join(" "));

  // Generator for a random recipe verb
  const recipeVerb = fc.constantFrom(...RECIPE_VERBS);

  // Generator for a numeric quantity (integer or decimal)
  const numericQuantity = fc.oneof(
    fc.integer({ min: 1, max: 999 }).map(String),
    fc
      .tuple(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 9 }))
      .map(([whole, frac]) => `${whole}.${frac}`),
    fc
      .tuple(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 2, max: 8 }))
      .map(([num, denom]) => `${num}/${denom}`)
  );

  it("text with at least one ingredient quantity AND at least one action verb returns true", () => {
    fc.assert(
      fc.property(
        paddingText,
        numericQuantity,
        recipeVerb,
        paddingText,
        (prefix, quantity, verb, suffix) => {
          const text = `${prefix} ${quantity} items then ${verb} well ${suffix}`.trim();
          expect(hasRecipeContent(text)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("text with quantity but no verb returns false", () => {
    fc.assert(
      fc.property(paddingText, numericQuantity, paddingText, (prefix, quantity, suffix) => {
        // Construct text that has a quantity but no recipe verb
        const text = `${prefix} ${quantity} things are here ${suffix}`.trim();
        expect(hasRecipeContent(text)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("text with verb but no quantity returns false", () => {
    fc.assert(
      fc.property(paddingText, recipeVerb, paddingText, (prefix, verb, suffix) => {
        // Construct text that has a verb but no numeric quantity or measurement word
        const text = `${prefix} ${verb} everything together ${suffix}`.trim();
        expect(hasRecipeContent(text)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
