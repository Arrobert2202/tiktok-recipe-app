import { describe, it, expect } from "vitest";
import {
  mergeIngredients,
  categorizeIngredient,
  groupByCategory,
  normalizeIngredientName,
  canonicalizeUnit,
  parseQuantity,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ShoppingListRecipe,
} from "./shopping-list";

describe("parseQuantity", () => {
  it("parses integers and decimals", () => {
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity("200")).toBe(200);
    expect(parseQuantity("2.5")).toBe(2.5);
  });

  it("parses simple fractions", () => {
    expect(parseQuantity("1/2")).toBe(0.5);
    expect(parseQuantity("3/4")).toBe(0.75);
  });

  it("parses unicode fractions", () => {
    expect(parseQuantity("½")).toBe(0.5);
    expect(parseQuantity("¼")).toBe(0.25);
    expect(parseQuantity("¾")).toBe(0.75);
    expect(parseQuantity("⅓")).toBeCloseTo(1 / 3);
    expect(parseQuantity("⅔")).toBeCloseTo(2 / 3);
  });

  it("parses mixed numbers", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("1½")).toBe(1.5);
  });

  it("returns null for non-numeric quantities", () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("   ")).toBeNull();
    expect(parseQuantity("a handful")).toBeNull();
    expect(parseQuantity("to taste")).toBeNull();
    expect(parseQuantity("2-3")).toBeNull();
    expect(parseQuantity(undefined)).toBeNull();
  });
});

describe("canonicalizeUnit", () => {
  it("maps equivalent spellings to one canonical token", () => {
    expect(canonicalizeUnit("grams")).toBe(canonicalizeUnit("g"));
    expect(canonicalizeUnit("Gram")).toBe("g");
    expect(canonicalizeUnit("tablespoons")).toBe("tbsp");
    expect(canonicalizeUnit("teaspoon")).toBe("tsp");
    expect(canonicalizeUnit("cups")).toBe("cup");
    expect(canonicalizeUnit("ounces")).toBe("oz");
    expect(canonicalizeUnit("pounds")).toBe("lb");
    expect(canonicalizeUnit("milliliter")).toBe("ml");
    expect(canonicalizeUnit("liters")).toBe("l");
  });

  it("keeps distinct units distinct and does not convert systems", () => {
    expect(canonicalizeUnit("g")).not.toBe(canonicalizeUnit("oz"));
    expect(canonicalizeUnit("ml")).not.toBe(canonicalizeUnit("cup"));
  });

  it("treats missing units as empty", () => {
    expect(canonicalizeUnit("")).toBe("");
    expect(canonicalizeUnit(undefined)).toBe("");
  });
});

describe("normalizeIngredientName", () => {
  it("strips descriptors and singularizes so variants group together", () => {
    expect(normalizeIngredientName("1 small onion, diced")).toBe("onion");
    expect(normalizeIngredientName("2 onions")).toBe("onion");
    expect(normalizeIngredientName("finely chopped fresh onion")).toBe("onion");
    expect(normalizeIngredientName("Tomatoes")).toBe("tomato");
  });

  it("keeps meaningful multi-word names intact", () => {
    expect(normalizeIngredientName("tomato paste")).toBe("tomato paste");
    expect(normalizeIngredientName("Olive Oil")).toBe("olive oil");
  });

  it("falls back to the raw tokens when everything looks like a descriptor", () => {
    expect(normalizeIngredientName("fresh")).toBe("fresh");
  });
});

describe("mergeIngredients", () => {
  it("returns an empty array for empty input", () => {
    expect(mergeIngredients([])).toEqual([]);
    expect(mergeIngredients([{ title: "Empty", ingredients: [] }])).toEqual([]);
  });

  it("sums quantities when the name and unit match", () => {
    const items = mergeIngredients([
      { title: "Pasta", ingredients: [{ name: "flour", quantity: "200", unit: "g" }] },
      { title: "Bread", ingredients: [{ name: "flour", quantity: "300", unit: "g" }] },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Flour");
    expect(items[0].merged).toBe("500 g");
    expect(items[0].quantities).toEqual(["200 g", "300 g"]);
    expect(items[0].checked).toBe(false);
  });

  it("normalizes unit aliases before summing (grams == g)", () => {
    const items = mergeIngredients([
      { title: "A", ingredients: [{ name: "sugar", quantity: "200", unit: "g" }] },
      { title: "B", ingredients: [{ name: "sugar", quantity: "300", unit: "grams" }] },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].merged).toBe("500 g");
  });

  it("sums unicode fractions", () => {
    const items = mergeIngredients([
      { title: "A", ingredients: [{ name: "sugar", quantity: "½", unit: "cup" }] },
      { title: "B", ingredients: [{ name: "sugar", quantity: "¼", unit: "cups" }] },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].merged).toBe("0.75 cup");
  });

  it("does not merge across different units, joining with ' + ' instead", () => {
    const items = mergeIngredients([
      { title: "A", ingredients: [{ name: "milk", quantity: "200", unit: "ml" }] },
      { title: "B", ingredients: [{ name: "milk", quantity: "1", unit: "cup" }] },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].merged).toBe("200 ml + 1 cup");
    expect(items[0].quantities).toEqual(["200 ml", "1 cup"]);
  });

  it("does not force a sum when a quantity is non-numeric", () => {
    const items = mergeIngredients([
      { title: "A", ingredients: [{ name: "spinach", quantity: "2", unit: "cups" }] },
      { title: "B", ingredients: [{ name: "spinach", quantity: "a handful", unit: "" }] },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].merged).toBe("2 cups + a handful");
  });

  it("leaves the merged string empty when no quantities are known", () => {
    const items = mergeIngredients([
      { title: "A", ingredients: [{ name: "salt", quantity: "", unit: "" }] },
      { title: "B", ingredients: [{ name: "salt", quantity: "", unit: "" }] },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].merged).toBe("");
    expect(items[0].quantities).toEqual([]);
  });

  it("groups descriptor variants and prefers the shortest display name", () => {
    const items = mergeIngredients([
      {
        title: "Soup",
        ingredients: [{ name: "small onion, diced", quantity: "1", unit: "" }],
      },
      { title: "Curry", ingredients: [{ name: "onions", quantity: "2", unit: "" }] },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Onions");
    expect(items[0].merged).toBe("3");
    expect(items[0].category).toBe("produce");
  });

  it("accumulates every contributing recipe title without duplicates", () => {
    const recipes: ShoppingListRecipe[] = [
      {
        title: "Bolognese",
        ingredients: [
          { name: "garlic", quantity: "2", unit: "cloves" },
          { name: "garlic", quantity: "1", unit: "clove" },
        ],
      },
      { title: "Aglio e Olio", ingredients: [{ name: "garlic", quantity: "4", unit: "cloves" }] },
      { title: "Pesto", ingredients: [{ name: "basil", quantity: "1", unit: "bunch" }] },
    ];

    const items = mergeIngredients(recipes);
    const garlic = items.find((item) => item.name === "Garlic");

    expect(garlic).toBeDefined();
    expect(garlic!.recipeTitles).toEqual(["Bolognese", "Aglio e Olio"]);
    expect(garlic!.merged).toBe("7 cloves");

    const basil = items.find((item) => item.name === "Basil");
    expect(basil!.recipeTitles).toEqual(["Pesto"]);
  });
});

describe("categorizeIngredient", () => {
  it("prefers longer, more specific keywords", () => {
    expect(categorizeIngredient("tomato paste")).toBe("pantry");
    expect(categorizeIngredient("tomato")).toBe("produce");
    expect(categorizeIngredient("chicken stock")).toBe("pantry");
    expect(categorizeIngredient("chicken breast")).toBe("meat_seafood");
    expect(categorizeIngredient("peanut butter")).toBe("pantry");
    expect(categorizeIngredient("butter")).toBe("dairy_eggs");
  });

  it("respects word boundaries", () => {
    expect(categorizeIngredient("peppercorns")).toBe("spices");
    expect(categorizeIngredient("eggplant")).toBe("produce");
    expect(categorizeIngredient("breadcrumbs")).toBe("pantry");
  });

  it("sends anything frozen to the freezer aisle", () => {
    expect(categorizeIngredient("frozen spinach")).toBe("frozen");
    expect(categorizeIngredient("frozen peas")).toBe("frozen");
  });

  it("covers each supermarket section", () => {
    expect(categorizeIngredient("Onions")).toBe("produce");
    expect(categorizeIngredient("Ground Beef")).toBe("meat_seafood");
    expect(categorizeIngredient("Mozzarella")).toBe("dairy_eggs");
    expect(categorizeIngredient("Tortillas")).toBe("bakery");
    expect(categorizeIngredient("All-purpose flour")).toBe("pantry");
    expect(categorizeIngredient("Smoked paprika")).toBe("spices");
  });

  it("falls back to other for unknown ingredients", () => {
    expect(categorizeIngredient("xyzzy powder")).toBe("other");
    expect(categorizeIngredient("")).toBe("other");
  });
});

describe("groupByCategory", () => {
  it("returns every category key and preserves item order", () => {
    const items = mergeIngredients([
      {
        title: "Dinner",
        ingredients: [
          { name: "onion", quantity: "1", unit: "" },
          { name: "garlic", quantity: "2", unit: "cloves" },
          { name: "chicken thighs", quantity: "500", unit: "g" },
          { name: "salt", quantity: "1", unit: "tsp" },
        ],
      },
    ]);

    const grouped = groupByCategory(items);

    expect(Object.keys(grouped).sort()).toEqual([...CATEGORY_ORDER].sort());
    expect(grouped.produce.map((item) => item.name)).toEqual(["Onion", "Garlic"]);
    expect(grouped.meat_seafood.map((item) => item.name)).toEqual(["Chicken Thighs"]);
    expect(grouped.spices.map((item) => item.name)).toEqual(["Salt"]);
    expect(grouped.bakery).toEqual([]);
  });

  it("has a label and emoji for every category", () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[category].label.length).toBeGreaterThan(0);
      expect(CATEGORY_LABELS[category].emoji.length).toBeGreaterThan(0);
    }
  });
});
