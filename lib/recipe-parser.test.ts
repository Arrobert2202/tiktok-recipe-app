import { describe, it, expect, vi, beforeEach } from "vitest";
import { TextTooLongError, RecipeParseError } from "./errors";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mocked-model"),
}));

import { parseRecipeFromText } from "./recipe-parser";
import { generateObject } from "ai";

const mockedGenerateObject = vi.mocked(generateObject);

describe("parseRecipeFromText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws TextTooLongError when input exceeds 50,000 characters", async () => {
    const longText = "a".repeat(50_001);

    await expect(parseRecipeFromText(longText)).rejects.toThrow(TextTooLongError);
    await expect(parseRecipeFromText(longText)).rejects.toMatchObject({
      code: "TEXT_TOO_LONG",
      length: 50_001,
    });
    expect(mockedGenerateObject).not.toHaveBeenCalled();
  });

  it("accepts input at exactly 50,000 characters", async () => {
    const exactText = "a".repeat(50_000);
    mockedGenerateObject.mockResolvedValue({
      object: {
        title: "Test Recipe",
        ingredients: [{ name: "flour", quantity: "2", unit: "cups" }],
        steps: ["Mix ingredients"],
      },
    } as any);

    const result = await parseRecipeFromText(exactText);
    expect(result.title).toBe("Test Recipe");
    expect(mockedGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("returns structured recipe on successful parse", async () => {
    mockedGenerateObject.mockResolvedValue({
      object: {
        title: "Garlic Pasta",
        ingredients: [
          { name: "pasta", quantity: "1", unit: "lb" },
          { name: "garlic", quantity: "4", unit: "cloves" },
          { name: "olive oil" },
        ],
        steps: ["Boil pasta", "Sauté garlic in olive oil", "Toss together"],
      },
    } as any);

    const result = await parseRecipeFromText("ok so you need pasta and garlic...");
    expect(result.title).toBe("Garlic Pasta");
    expect(result.ingredients).toHaveLength(3);
    expect(result.steps).toHaveLength(3);
  });

  it("throws RecipeParseError when generateObject fails", async () => {
    mockedGenerateObject.mockRejectedValue(new Error("LLM failed to generate"));

    const inputText = "this is just random text without recipes";
    await expect(parseRecipeFromText(inputText)).rejects.toThrow(RecipeParseError);
    await expect(parseRecipeFromText(inputText)).rejects.toMatchObject({
      code: "RECIPE_PARSE_FAILED",
      sourceText: inputText,
    });
  });

  it("passes the input text in the prompt to generateObject", async () => {
    mockedGenerateObject.mockResolvedValue({
      object: {
        title: "Simple Recipe",
        ingredients: [{ name: "sugar" }],
        steps: ["Add sugar"],
      },
    } as any);

    await parseRecipeFromText("add a cup of sugar yall");

    expect(mockedGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("add a cup of sugar yall"),
      })
    );
  });

  it("uses the recipeSchema for structured output", async () => {
    mockedGenerateObject.mockResolvedValue({
      object: {
        title: "Test",
        ingredients: [{ name: "item" }],
        steps: ["Step 1"],
      },
    } as any);

    await parseRecipeFromText("some recipe text");

    expect(mockedGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.any(Object),
        model: "mocked-model",
      })
    );
  });
});
