import { describe, it, expect } from "vitest";
import {
  hasRecipeContent,
  hasIngredientQuantity,
  hasActionVerb,
} from "./recipe-detection";

describe("hasRecipeContent", () => {
  describe("returns true when text has both quantity + verb", () => {
    it("numeric quantity and action verb", () => {
      expect(hasRecipeContent("Add 2 cups of flour and mix well")).toBe(true);
    });

    it("decimal quantity and action verb", () => {
      expect(hasRecipeContent("Chop 1.5 lbs of chicken")).toBe(true);
    });

    it("fraction quantity and action verb", () => {
      expect(hasRecipeContent("Mix 1/2 cup sugar into the batter")).toBe(true);
    });

    it("measurement word and action verb", () => {
      expect(hasRecipeContent("Add a pinch of salt and stir")).toBe(true);
    });

    it("multiple quantities and verbs", () => {
      expect(
        hasRecipeContent("Mix 2 cups flour, 1 tsp salt, then bake at 350")
      ).toBe(true);
    });
  });

  describe("returns false when text has quantity but no verb", () => {
    it("just measurement without cooking action", () => {
      expect(hasRecipeContent("I bought 2 cups at the store")).toBe(false);
    });

    it("numeric quantity with no cooking verb", () => {
      expect(hasRecipeContent("This video has 3 million views")).toBe(false);
    });

    it("measurement word without action verb", () => {
      expect(hasRecipeContent("A pinch of luck is all you need")).toBe(false);
    });
  });

  describe("returns false when text has verb but no quantity", () => {
    it("action verb without any quantity", () => {
      expect(hasRecipeContent("Mix it up on the dance floor")).toBe(false);
    });

    it("multiple verbs but no quantities", () => {
      expect(hasRecipeContent("Stir up some fun and bake memories")).toBe(
        false
      );
    });
  });

  describe("real-world TikTok caption examples", () => {
    it("detects recipe in typical cooking caption", () => {
      expect(
        hasRecipeContent(
          "Easy pasta recipe! Boil 200g spaghetti, fry 4 slices bacon, mix with 2 eggs and parmesan 🍝"
        )
      ).toBe(true);
    });

    it("detects recipe in casual cooking caption", () => {
      expect(
        hasRecipeContent(
          "yall gotta try this!! chop half an onion, add 1 tbsp butter and cook until golden 😍"
        )
      ).toBe(true);
    });

    it("detects recipe with measurement words", () => {
      expect(
        hasRecipeContent(
          "Secret sauce: combine a handful of basil with 3 cloves garlic, blend until smooth"
        )
      ).toBe(true);
    });

    it("rejects non-recipe TikTok caption", () => {
      expect(
        hasRecipeContent(
          "POV: when your mom catches you eating at midnight 😂 #relatable #funny"
        )
      ).toBe(false);
    });

    it("rejects dance/music TikTok caption", () => {
      expect(
        hasRecipeContent(
          "new dance tutorial! follow along with me 💃 #dance #fyp #viral"
        )
      ).toBe(false);
    });

    it("rejects fitness caption with numbers", () => {
      expect(
        hasRecipeContent(
          "Day 30 of my fitness journey! Lost 15 pounds this month 💪"
        )
      ).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles stemmed verbs like 'chopping'", () => {
      expect(hasRecipeContent("Chopping 3 carrots for dinner")).toBe(true);
    });

    it("handles past tense verbs like 'baked'", () => {
      expect(hasRecipeContent("I baked 2 dozen cookies today")).toBe(true);
    });

    it("handles gerund forms like 'stirring'", () => {
      expect(hasRecipeContent("Keep stirring the 1 cup of sauce")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(hasRecipeContent("MIX 2 CUPS FLOUR WITH SUGAR")).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(hasRecipeContent("")).toBe(false);
    });

    it("returns false for whitespace-only string", () => {
      expect(hasRecipeContent("   ")).toBe(false);
    });

    it("handles 'dozen' as a measurement word", () => {
      expect(hasRecipeContent("Slice a dozen tomatoes")).toBe(true);
    });

    it("handles 'half' as a measurement word", () => {
      expect(hasRecipeContent("Dice half the peppers")).toBe(true);
    });

    it("does not match verb inside unrelated words", () => {
      // "adding" contains "add" — should match since stemmed form is valid
      expect(hasRecipeContent("Adding 1 cup is easy")).toBe(true);
      // "paddle" contains no recipe verbs at word boundary
      expect(hasRecipeContent("I went paddleboarding yesterday")).toBe(false);
    });
  });
});

describe("hasIngredientQuantity", () => {
  it("detects integer values", () => {
    expect(hasIngredientQuantity("add 2 eggs")).toBe(true);
  });

  it("detects decimal values", () => {
    expect(hasIngredientQuantity("use 2.5 cups")).toBe(true);
  });

  it("detects fraction values", () => {
    expect(hasIngredientQuantity("add 1/2 teaspoon")).toBe(true);
  });

  it("detects measurement words", () => {
    expect(hasIngredientQuantity("a pinch of salt")).toBe(true);
    expect(hasIngredientQuantity("add a handful of spinach")).toBe(true);
    expect(hasIngredientQuantity("one tablespoon olive oil")).toBe(true);
  });

  it("returns false when no quantity present", () => {
    expect(hasIngredientQuantity("just vibes")).toBe(false);
    expect(hasIngredientQuantity("this is a great video")).toBe(false);
  });
});

describe("hasActionVerb", () => {
  it("detects base form verbs", () => {
    expect(hasActionVerb("mix the ingredients")).toBe(true);
    expect(hasActionVerb("bake for 30 minutes")).toBe(true);
  });

  it("detects past tense forms", () => {
    expect(hasActionVerb("I chopped the onions")).toBe(true);
    expect(hasActionVerb("She roasted the chicken")).toBe(true);
  });

  it("detects progressive/gerund forms", () => {
    expect(hasActionVerb("keep stirring constantly")).toBe(true);
    expect(hasActionVerb("while simmering on low")).toBe(true);
  });

  it("detects third person forms", () => {
    expect(hasActionVerb("she slices the bread")).toBe(true);
    expect(hasActionVerb("he grills the steak")).toBe(true);
  });

  it("returns false when no action verb present", () => {
    expect(hasActionVerb("this is my favorite food")).toBe(false);
    expect(hasActionVerb("check out my new video")).toBe(false);
  });

  it("handles sauté with accent", () => {
    expect(hasActionVerb("sauté the vegetables")).toBe(true);
  });

  it("handles saute without accent", () => {
    expect(hasActionVerb("saute the garlic")).toBe(true);
  });
});
