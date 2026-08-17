import { describe, it, expect } from "vitest";
import { serialize, deserialize, RecipeData } from "./recipe-serializer";

describe("recipe-serializer", () => {
  const validRecipe: RecipeData = {
    title: "Garlic Pasta",
    ingredients: [
      { name: "spaghetti", quantity: "200", unit: "g" },
      { name: "garlic", quantity: "4", unit: "cloves" },
      { name: "olive oil", quantity: "", unit: "" },
    ],
    steps: ["Boil the pasta", "Sauté garlic in olive oil", "Toss pasta with garlic oil"],
    tipsAndTricks: [],
  };

  describe("serialize", () => {
    it("produces valid JSON", () => {
      const json = serialize(validRecipe);
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe("round-trip", () => {
    it("valid recipe round-trips correctly", () => {
      const json = serialize(validRecipe);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validRecipe);
      }
    });

    it("preserves array ordering of ingredients", () => {
      const recipe: RecipeData = {
        title: "Test Recipe",
        ingredients: [
          { name: "first", quantity: "", unit: "" },
          { name: "second", quantity: "", unit: "" },
          { name: "third", quantity: "", unit: "" },
        ],
        steps: ["Step 1"],
        tipsAndTricks: [],
      };

      const json = serialize(recipe);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ingredients[0].name).toBe("first");
        expect(result.data.ingredients[1].name).toBe("second");
        expect(result.data.ingredients[2].name).toBe("third");
      }
    });

    it("preserves array ordering of steps", () => {
      const recipe: RecipeData = {
        title: "Test Recipe",
        ingredients: [{ name: "item", quantity: "1", unit: "piece" }],
        steps: ["First step", "Second step", "Third step"],
        tipsAndTricks: [],
      };

      const json = serialize(recipe);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.steps).toEqual(["First step", "Second step", "Third step"]);
      }
    });

    it("preserves quantity and unit values", () => {
      const recipe: RecipeData = {
        title: "Test",
        ingredients: [{ name: "flour", quantity: "2.5", unit: "cups" }],
        steps: ["Mix"],
        tipsAndTricks: [],
      };

      const json = serialize(recipe);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ingredients[0].quantity).toBe("2.5");
        expect(result.data.ingredients[0].unit).toBe("cups");
      }
    });

    it("preserves empty string for quantity and unit when unknown", () => {
      const recipe: RecipeData = {
        title: "Test",
        ingredients: [{ name: "salt", quantity: "", unit: "" }],
        steps: ["Season to taste"],
        tipsAndTricks: [],
      };

      const json = serialize(recipe);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ingredients[0].quantity).toBe("");
        expect(result.data.ingredients[0].unit).toBe("");
      }
    });

    it("preserves numeric precision in quantity strings", () => {
      const recipe: RecipeData = {
        title: "Precision Test",
        ingredients: [
          { name: "sugar", quantity: "0.333", unit: "cups" },
          { name: "water", quantity: "1.75", unit: "liters" },
        ],
        steps: ["Combine"],
        tipsAndTricks: [],
      };

      const json = serialize(recipe);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ingredients[0].quantity).toBe("0.333");
        expect(result.data.ingredients[1].quantity).toBe("1.75");
      }
    });

    it("preserves tipsAndTricks when present", () => {
      const recipe: RecipeData = {
        title: "Tips Test",
        ingredients: [{ name: "flour", quantity: "1", unit: "cup" }],
        steps: ["Mix"],
        tipsAndTricks: ["Rest the dough for 30 minutes", "Use cold butter"],
      };

      const json = serialize(recipe);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tipsAndTricks).toEqual(["Rest the dough for 30 minutes", "Use cold butter"]);
      }
    });
  });

  describe("deserialize error handling", () => {
    it("returns invalid_json error for malformed JSON", () => {
      const result = deserialize("not json at all");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("invalid_json");
        expect(result.error.message).toContain("not valid JSON");
      }
    });

    it("returns invalid_json error for empty string", () => {
      const result = deserialize("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("invalid_json");
      }
    });

    it("returns schema_violation error for valid JSON missing required fields", () => {
      const result = deserialize(JSON.stringify({ title: "Hello" }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("schema_violation");
        expect(result.error.message).toContain("does not conform");
        expect(result.error.details).toBeDefined();
      }
    });

    it("returns schema_violation error for empty title", () => {
      const result = deserialize(
        JSON.stringify({
          title: "",
          ingredients: [{ name: "flour", quantity: "1", unit: "cup" }],
          steps: ["Mix"],
          tipsAndTricks: [],
        })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("schema_violation");
      }
    });

    it("returns schema_violation error for empty ingredients array", () => {
      const result = deserialize(
        JSON.stringify({
          title: "Test",
          ingredients: [],
          steps: ["Mix"],
          tipsAndTricks: [],
        })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("schema_violation");
      }
    });

    it("returns schema_violation error for empty steps array", () => {
      const result = deserialize(
        JSON.stringify({
          title: "Test",
          ingredients: [{ name: "flour", quantity: "1", unit: "cup" }],
          steps: [],
          tipsAndTricks: [],
        })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("schema_violation");
      }
    });

    it("returns schema_violation error for ingredient missing name", () => {
      const result = deserialize(
        JSON.stringify({
          title: "Test",
          ingredients: [{ quantity: "2", unit: "cups" }],
          steps: ["Mix"],
          tipsAndTricks: [],
        })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("schema_violation");
      }
    });

    it("returns schema_violation for wrong types", () => {
      const result = deserialize(
        JSON.stringify({
          title: 123,
          ingredients: [{ name: "flour", quantity: "1", unit: "cup" }],
          steps: ["Mix"],
          tipsAndTricks: [],
        })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("schema_violation");
      }
    });

    it("never throws an exception for any input", () => {
      const inputs = [
        "",
        "null",
        "undefined",
        "[]",
        "{}",
        "42",
        '"string"',
        "not json",
        "{broken: json}",
      ];

      for (const input of inputs) {
        expect(() => deserialize(input)).not.toThrow();
      }
    });
  });
});
