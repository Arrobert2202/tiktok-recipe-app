import { describe, it, expect } from "vitest";
import { buildRecipeJsonLd, formatIngredient, type RecipeSchemaInput } from "./recipe-schema";

const APP_URL = "https://recipes.example.com";

function baseRecipe(overrides: Partial<RecipeSchemaInput> = {}): RecipeSchemaInput {
  return {
    slug: "abc123def456",
    title: "Loaded Cheesesteak Sliders",
    creatorHandle: "chefjoe",
    creatorProfileUrl: "https://www.tiktok.com/@chefjoe",
    ingredients: [
      { name: "ground beef", quantity: "1", unit: "lb" },
      { name: "salt", quantity: "", unit: "" },
    ],
    steps: ["Brown the beef", "Assemble the sliders"],
    tipsAndTricks: [],
    thumbnailUrl: null,
    createdAt: new Date("2024-05-01T10:00:00.000Z"),
    updatedAt: new Date("2024-05-02T11:30:00.000Z"),
    appUrl: APP_URL,
    ...overrides,
  };
}

describe("formatIngredient", () => {
  it("joins quantity, unit and name in order", () => {
    expect(formatIngredient({ name: "flour", quantity: "2", unit: "cups" })).toBe(
      "2 cups flour"
    );
  });

  it("omits an empty quantity", () => {
    expect(formatIngredient({ name: "olive oil", quantity: "", unit: "tbsp" })).toBe(
      "tbsp olive oil"
    );
  });

  it("omits an empty unit", () => {
    expect(formatIngredient({ name: "eggs", quantity: "3", unit: "" })).toBe("3 eggs");
  });

  it("returns just the name when quantity and unit are empty", () => {
    expect(formatIngredient({ name: "salt", quantity: "", unit: "" })).toBe("salt");
  });

  it("trims whitespace-only parts instead of leaving double spaces", () => {
    expect(formatIngredient({ name: " basil ", quantity: "  ", unit: " " })).toBe("basil");
  });
});

describe("buildRecipeJsonLd", () => {
  it("sets the schema.org context and Recipe type", () => {
    const jsonLd = buildRecipeJsonLd(baseRecipe());
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Recipe");
    expect(jsonLd.name).toBe("Loaded Cheesesteak Sliders");
    expect(jsonLd.url).toBe(`${APP_URL}/r/abc123def456`);
    expect(jsonLd.isAccessibleForFree).toBe(true);
  });

  it("formats ingredient strings and drops empty quantity/unit parts", () => {
    const jsonLd = buildRecipeJsonLd(baseRecipe());
    expect(jsonLd.recipeIngredient).toEqual(["1 lb ground beef", "salt"]);
  });

  it("skips ingredients that format to an empty string", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({
        ingredients: [
          { name: "", quantity: "", unit: "" },
          { name: "butter", quantity: "2", unit: "tbsp" },
        ],
      })
    );
    expect(jsonLd.recipeIngredient).toEqual(["2 tbsp butter"]);
  });

  it("attributes the author with an @handle and profile url", () => {
    const jsonLd = buildRecipeJsonLd(baseRecipe());
    expect(jsonLd.author).toEqual({
      "@type": "Person",
      name: "@chefjoe",
      url: "https://www.tiktok.com/@chefjoe",
    });
  });

  it("emits HowToStep instructions with sequential positions starting at 1", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({ steps: ["One", "Two", "Three", "Four"] })
    );
    expect(jsonLd.recipeInstructions).toEqual([
      { "@type": "HowToStep", position: 1, text: "One" },
      { "@type": "HowToStep", position: 2, text: "Two" },
      { "@type": "HowToStep", position: 3, text: "Three" },
      { "@type": "HowToStep", position: 4, text: "Four" },
    ]);
  });

  it("keeps positions sequential when blank steps are dropped", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({ steps: ["Mix", "   ", "", "Bake"] })
    );
    expect(jsonLd.recipeInstructions.map((i) => i.position)).toEqual([1, 2]);
    expect(jsonLd.recipeInstructions.map((i) => i.text)).toEqual(["Mix", "Bake"]);
  });

  it("appends tips as HowToTip entries continuing the position sequence", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({
        steps: ["Brown the beef", "Assemble"],
        tipsAndTricks: ["Use brioche buns"],
      })
    );
    expect(jsonLd.recipeInstructions).toEqual([
      { "@type": "HowToStep", position: 1, text: "Brown the beef" },
      { "@type": "HowToStep", position: 2, text: "Assemble" },
      { "@type": "HowToTip", position: 3, text: "Use brioche buns" },
    ]);
  });

  it("omits optional fields instead of setting them to null or undefined", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({ thumbnailUrl: null, creatorProfileUrl: null })
    );
    expect("image" in jsonLd).toBe(false);
    expect("url" in jsonLd.author).toBe(false);
    for (const value of Object.values(jsonLd)) {
      expect(value).not.toBeNull();
      expect(value).not.toBeUndefined();
    }
  });

  it("includes image when a thumbnail url is present", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({ thumbnailUrl: "https://cdn.example.com/thumb.jpg" })
    );
    expect(jsonLd.image).toBe("https://cdn.example.com/thumb.jpg");
  });

  it("emits ISO 8601 published and modified dates", () => {
    const jsonLd = buildRecipeJsonLd(baseRecipe());
    expect(jsonLd.datePublished).toBe("2024-05-01T10:00:00.000Z");
    expect(jsonLd.dateModified).toBe("2024-05-02T11:30:00.000Z");
  });

  it("omits dates that cannot be parsed rather than emitting null", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({ createdAt: "not-a-date", updatedAt: "not-a-date" })
    );
    expect("datePublished" in jsonLd).toBe(false);
    expect("dateModified" in jsonLd).toBe(false);
  });

  it("normalizes a trailing slash on the app url", () => {
    const jsonLd = buildRecipeJsonLd(baseRecipe({ appUrl: "https://recipes.example.com/" }));
    expect(jsonLd.url).toBe("https://recipes.example.com/r/abc123def456");
  });

  it("produces JSON-serializable output that round-trips", () => {
    const jsonLd = buildRecipeJsonLd(
      baseRecipe({
        title: 'Spicy "Mayo" Sliders & Fries',
        tipsAndTricks: ["Chill the <sauce> first"],
        thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      })
    );
    const serialized = JSON.stringify(jsonLd);
    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(JSON.parse(serialized)).toEqual(jsonLd);
  });
});
