import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validTag } from "./generators/cookbook.gen";
import {
  validateTag,
  validateTags,
  validateTikTokHandle,
  validateRecipeEdit,
} from "@/lib/validation";

describe("Property 9: Tag Validation Constraints", () => {
  /**
   * **Validates: Requirements 6.5**
   */

  it("rejects any string exceeding 50 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 51, maxLength: 200 }),
        (tag) => {
          expect(validateTag(tag)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepts any string of 1-50 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (tag) => {
          expect(validateTag(tag)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects adding a tag when recipe already has 20 tags", () => {
    fc.assert(
      fc.property(validTag, (tag) => {
        const result = validateTags([tag], 20);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.tags).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it("accepts valid tags (1-50 chars) on recipe with fewer than 20 tags", () => {
    fc.assert(
      fc.property(
        validTag,
        fc.integer({ min: 0, max: 19 }),
        (tag, existingCount) => {
          const result = validateTags([tag], existingCount);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 12: TikTok Handle Format Validation", () => {
  /**
   * **Validates: Requirements 10.8**
   */

  it("accepts any string of alphanumeric + underscore, 1-24 chars", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9_]{1,24}$/), (handle) => {
        expect(validateTikTokHandle(handle)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects empty strings, strings >24 chars, or strings with special characters", () => {
    const invalidHandle = fc.oneof(
      // Empty string
      fc.constant(""),
      // Too long (valid chars only, but >24)
      fc.stringMatching(/^[a-zA-Z0-9_]{25,50}$/),
      // Contains special characters (1-24 chars with at least one invalid char)
      fc
        .tuple(
          fc.stringMatching(/^[a-zA-Z0-9_]{0,10}$/),
          fc.constantFrom("@", "!", "#", "$", "%", "^", "&", "*", "-", ".", " ", "/"),
          fc.stringMatching(/^[a-zA-Z0-9_]{0,10}$/)
        )
        .map(([prefix, special, suffix]) => prefix + special + suffix)
        .filter((s) => s.length >= 1 && s.length <= 24)
    );

    fc.assert(
      fc.property(invalidHandle, (handle) => {
        expect(validateTikTokHandle(handle)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 10: Edit Input Validation", () => {
  /**
   * **Validates: Requirements 7.2, 7.3**
   */

  it("accepts input with non-empty title ≤200 chars, ≥1 ingredient with non-empty name, ≥1 non-empty step", () => {
    const validTitle = fc
      .string({ minLength: 1, maxLength: 200 })
      .filter((s) => s.trim().length > 0);
    const validIngredient = fc.record({
      name: fc
        .string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length > 0),
      quantity: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
        nil: undefined,
      }),
      unit: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
        nil: undefined,
      }),
    });
    const validStep = fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0);

    const validInput = fc.record({
      title: validTitle,
      ingredients: fc.array(validIngredient, { minLength: 1, maxLength: 10 }),
      steps: fc.array(validStep, { minLength: 1, maxLength: 10 }),
    });

    fc.assert(
      fc.property(validInput, (input) => {
        const result = validateRecipeEdit(input);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it("rejects empty title, empty ingredients, or empty steps with field-level errors", () => {
    const invalidInput = fc.oneof(
      // Empty/whitespace title
      fc.record({
        title: fc.constantFrom("", "   ", "\t", "\n"),
        ingredients: fc.constant([
          { name: "flour", quantity: "1", unit: "cup" },
        ] as { name: string; quantity?: string; unit?: string }[]),
        steps: fc.constant(["Mix ingredients"] as string[]),
      }),
      // Empty ingredients array
      fc.record({
        title: fc.constant("Valid Title"),
        ingredients: fc.constant(
          [] as { name: string; quantity?: string; unit?: string }[]
        ),
        steps: fc.constant(["Mix ingredients"] as string[]),
      }),
      // Ingredients with all-empty names
      fc.record({
        title: fc.constant("Valid Title"),
        ingredients: fc.constant([{ name: "" }, { name: "   " }] as { name: string; quantity?: string; unit?: string }[]),
        steps: fc.constant(["Mix ingredients"] as string[]),
      }),
      // Empty steps array
      fc.record({
        title: fc.constant("Valid Title"),
        ingredients: fc.constant([{ name: "flour" }] as { name: string; quantity?: string; unit?: string }[]),
        steps: fc.constant([] as string[]),
      }),
      // Steps that are all empty/whitespace
      fc.record({
        title: fc.constant("Valid Title"),
        ingredients: fc.constant([{ name: "flour" }] as { name: string; quantity?: string; unit?: string }[]),
        steps: fc.constant(["", "   "] as string[]),
      })
    );

    fc.assert(
      fc.property(invalidInput, (input) => {
        const result = validateRecipeEdit(input);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});
