import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validRecipe } from "./generators/recipe.gen";
import { serialize, deserialize } from "@/lib/recipe-serializer";

/**
 * Property 4: Recipe Serialization Round-Trip
 *
 * Validates: Requirements 3.6, 14.1, 14.2, 14.3
 */
describe("Property: Recipe Serialization Round-Trip", () => {
  it("serialize then deserialize produces a deeply equal object", () => {
    fc.assert(
      fc.property(validRecipe, (recipe) => {
        const json = serialize(recipe);
        const result = deserialize(json);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(recipe);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("array ordering is preserved for ingredients and steps", () => {
    fc.assert(
      fc.property(validRecipe, (recipe) => {
        const json = serialize(recipe);
        const result = deserialize(json);

        expect(result.success).toBe(true);
        if (result.success) {
          // Verify ingredient ordering
          expect(result.data.ingredients.length).toBe(recipe.ingredients.length);
          for (let i = 0; i < recipe.ingredients.length; i++) {
            expect(result.data.ingredients[i].name).toBe(recipe.ingredients[i].name);
          }

          // Verify step ordering
          expect(result.data.steps.length).toBe(recipe.steps.length);
          for (let i = 0; i < recipe.steps.length; i++) {
            expect(result.data.steps[i]).toBe(recipe.steps[i]);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it("quantity and unit values are preserved (including empty strings)", () => {
    fc.assert(
      fc.property(validRecipe, (recipe) => {
        const json = serialize(recipe);
        const result = deserialize(json);

        expect(result.success).toBe(true);
        if (result.success) {
          for (let i = 0; i < recipe.ingredients.length; i++) {
            const original = recipe.ingredients[i];
            const restored = result.data.ingredients[i];

            expect(restored.quantity).toBe(original.quantity);
            expect(restored.unit).toBe(original.unit);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Deserialization Error Handling
 *
 * Validates: Requirements 14.4, 14.5
 */
describe("Property: Deserialization Error Handling", () => {
  // Generator for strings that are NOT valid JSON
  const invalidJsonString = fc
    .string({ minLength: 1 })
    .filter((s) => {
      try {
        JSON.parse(s);
        return false;
      } catch {
        return true;
      }
    });

  // Generator for valid JSON that doesn't match the recipe schema
  const invalidSchemaJson = fc.oneof(
    // Missing required fields
    fc.record({ title: fc.string({ minLength: 1 }) }).map((o) => JSON.stringify(o)),
    // Wrong types for fields
    fc
      .record({
        title: fc.integer(),
        ingredients: fc.constant([{ name: "flour", quantity: "1", unit: "cup" }]),
        steps: fc.constant(["Mix"]),
        tipsAndTricks: fc.constant([]),
      })
      .map((o) => JSON.stringify(o)),
    // Empty ingredients array
    fc
      .record({
        title: fc.string({ minLength: 1, maxLength: 200 }),
        ingredients: fc.constant([]),
        steps: fc.constant(["Mix"]),
        tipsAndTricks: fc.constant([]),
      })
      .map((o) => JSON.stringify(o)),
    // Empty steps array
    fc
      .record({
        title: fc.string({ minLength: 1, maxLength: 200 }),
        ingredients: fc.constant([{ name: "flour", quantity: "1", unit: "cup" }]),
        steps: fc.constant([]),
        tipsAndTricks: fc.constant([]),
      })
      .map((o) => JSON.stringify(o)),
    // Ingredient missing name
    fc
      .record({
        title: fc.string({ minLength: 1, maxLength: 200 }),
        ingredients: fc.constant([{ quantity: "2", unit: "cups" }]),
        steps: fc.constant(["Mix"]),
        tipsAndTricks: fc.constant([]),
      })
      .map((o) => JSON.stringify(o)),
    // Random primitives that are valid JSON but not objects
    fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)).map((v) => JSON.stringify(v))
  );

  it("returns invalid_json error for any random string that is not valid JSON", () => {
    fc.assert(
      fc.property(invalidJsonString, (input) => {
        const result = deserialize(input);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("invalid_json");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns schema_violation error for valid JSON that does not match recipe schema", () => {
    fc.assert(
      fc.property(invalidSchemaJson, (jsonStr) => {
        const result = deserialize(jsonStr);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("schema_violation");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("deserialize never throws an exception for any input", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => deserialize(input)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});
