import { describe, it, expect } from "vitest";
import {
  validateTag,
  validateTags,
  validateTikTokHandle,
  validateRecipeEdit,
} from "./validation";

describe("validateTag", () => {
  it("accepts a valid tag (1-50 chars)", () => {
    expect(validateTag("dinner")).toBe(true);
    expect(validateTag("a")).toBe(true);
    expect(validateTag("x".repeat(50))).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(validateTag("")).toBe(false);
  });

  it("rejects a string exceeding 50 characters", () => {
    expect(validateTag("x".repeat(51))).toBe(false);
  });
});

describe("validateTags", () => {
  it("accepts valid tags within count limit", () => {
    const result = validateTags(["quick", "easy", "healthy"]);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("rejects when total tag count exceeds 20", () => {
    const result = validateTags(["new-tag"], 20);
    expect(result.valid).toBe(false);
    expect(result.errors?.tags).toBeDefined();
  });

  it("rejects tags exceeding 50 characters", () => {
    const result = validateTags(["x".repeat(51)]);
    expect(result.valid).toBe(false);
    expect(result.errors?.["tags[0]"]).toBeDefined();
  });

  it("accumulates both count and length errors", () => {
    const result = validateTags(["x".repeat(51)], 20);
    expect(result.valid).toBe(false);
    expect(result.errors?.tags).toBeDefined();
    expect(result.errors?.["tags[0]"]).toBeDefined();
  });
});

describe("validateTikTokHandle", () => {
  it("accepts valid handles", () => {
    expect(validateTikTokHandle("chef_mike")).toBe(true);
    expect(validateTikTokHandle("a")).toBe(true);
    expect(validateTikTokHandle("User123_")).toBe(true);
    expect(validateTikTokHandle("a".repeat(24))).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateTikTokHandle("")).toBe(false);
  });

  it("rejects handles exceeding 24 characters", () => {
    expect(validateTikTokHandle("a".repeat(25))).toBe(false);
  });

  it("rejects handles with invalid characters", () => {
    expect(validateTikTokHandle("user@name")).toBe(false);
    expect(validateTikTokHandle("user name")).toBe(false);
    expect(validateTikTokHandle("user-name")).toBe(false);
    expect(validateTikTokHandle("user.name")).toBe(false);
  });
});

describe("validateRecipeEdit", () => {
  const validInput = {
    title: "Pasta Carbonara",
    ingredients: [{ name: "spaghetti", quantity: "200", unit: "g" }],
    steps: ["Boil pasta", "Fry pancetta"],
  };

  it("accepts valid input", () => {
    const result = validateRecipeEdit(validInput);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("rejects empty title", () => {
    const result = validateRecipeEdit({ ...validInput, title: "" });
    expect(result.valid).toBe(false);
    expect(result.errors?.title).toBeDefined();
  });

  it("rejects whitespace-only title", () => {
    const result = validateRecipeEdit({ ...validInput, title: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors?.title).toBeDefined();
  });

  it("rejects title exceeding 200 characters", () => {
    const result = validateRecipeEdit({
      ...validInput,
      title: "x".repeat(201),
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.title).toBeDefined();
  });

  it("accepts title of exactly 200 characters", () => {
    const result = validateRecipeEdit({
      ...validInput,
      title: "x".repeat(200),
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty ingredients array", () => {
    const result = validateRecipeEdit({ ...validInput, ingredients: [] });
    expect(result.valid).toBe(false);
    expect(result.errors?.ingredients).toBeDefined();
  });

  it("rejects ingredients where all names are empty", () => {
    const result = validateRecipeEdit({
      ...validInput,
      ingredients: [{ name: "" }, { name: "   " }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.ingredients).toBeDefined();
  });

  it("accepts when at least one ingredient has a non-empty name", () => {
    const result = validateRecipeEdit({
      ...validInput,
      ingredients: [{ name: "" }, { name: "butter" }],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty steps array", () => {
    const result = validateRecipeEdit({ ...validInput, steps: [] });
    expect(result.valid).toBe(false);
    expect(result.errors?.steps).toBeDefined();
  });

  it("rejects steps where all are empty", () => {
    const result = validateRecipeEdit({
      ...validInput,
      steps: ["", "   "],
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.steps).toBeDefined();
  });

  it("returns multiple errors when multiple fields are invalid", () => {
    const result = validateRecipeEdit({
      title: "",
      ingredients: [],
      steps: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.title).toBeDefined();
    expect(result.errors?.ingredients).toBeDefined();
    expect(result.errors?.steps).toBeDefined();
  });
});
