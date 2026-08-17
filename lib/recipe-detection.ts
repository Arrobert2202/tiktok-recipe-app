/**
 * Recipe content detection logic.
 *
 * Determines whether a text string contains recipe content by checking for
 * at least one ingredient quantity AND at least one cooking action verb.
 */

/**
 * Curated set of cooking-related action verbs.
 * Matching uses word-boundary-aware patterns so stemmed forms
 * like "chopped", "baking", "stirs" are also detected.
 */
export const RECIPE_VERBS = [
  "mix",
  "bake",
  "chop",
  "stir",
  "fry",
  "cook",
  "boil",
  "simmer",
  "roast",
  "grill",
  "sauté",
  "saute",
  "sear",
  "blend",
  "whisk",
  "fold",
  "knead",
  "dice",
  "mince",
  "slice",
  "peel",
  "drain",
  "marinate",
  "season",
  "sprinkle",
  "pour",
  "heat",
  "preheat",
  "serve",
  "plate",
  "garnish",
  "combine",
  "add",
  "toss",
] as const;

/**
 * Measurement words that indicate an ingredient quantity.
 */
export const MEASUREMENT_WORDS = [
  "cup",
  "cups",
  "tbsp",
  "tsp",
  "tablespoon",
  "tablespoons",
  "teaspoon",
  "teaspoons",
  "oz",
  "ounce",
  "ounces",
  "pound",
  "pounds",
  "lb",
  "lbs",
  "g",
  "gram",
  "grams",
  "kg",
  "ml",
  "liter",
  "liters",
  "pinch",
  "dash",
  "handful",
  "dozen",
  "half",
] as const;

/**
 * Check whether the text contains at least one ingredient quantity.
 *
 * An ingredient quantity is either:
 * - A numeric value (integer, decimal, fraction like 1/2)
 * - A measurement word from the curated set
 */
export function hasIngredientQuantity(text: string): boolean {
  const lower = text.toLowerCase();

  // Check for numeric values: integers, decimals, fractions
  // Use word boundary to avoid matching numbers inside unrelated words
  const numericPattern = /(?:^|\s|[,(])(\d+([./]\d+)?)/;
  if (numericPattern.test(lower)) {
    return true;
  }

  // Check for measurement words using word boundaries
  for (const word of MEASUREMENT_WORDS) {
    const pattern = new RegExp(`\\b${word}s?\\b`, "i");
    if (pattern.test(lower)) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether the text contains at least one cooking action verb.
 *
 * Uses word-boundary matching so stemmed forms are detected:
 * e.g., "chopped" matches "chop", "baking" matches "bake".
 */
/**
 * Normalize text by stripping diacritics (accented characters → ASCII equivalents).
 */
function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Check whether the text contains at least one cooking action verb.
 *
 * Uses word-boundary matching so stemmed forms are detected:
 * e.g., "chopped" matches "chop", "baking" matches "bake".
 */
export function hasActionVerb(text: string): boolean {
  const lower = normalizeText(text.toLowerCase());

  for (const verb of RECIPE_VERBS) {
    // Normalize the verb as well (e.g., "sauté" → "saute")
    const normalizedVerb = normalizeText(verb);
    // Match the verb stem at a word boundary, allowing suffixes
    // like -ed, -ing, -s, -es
    const pattern = new RegExp(`\\b${normalizedVerb}\\w*\\b`, "i");
    if (pattern.test(lower)) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a text string contains recipe content.
 *
 * Recipe content is defined as text containing:
 * - At least one ingredient quantity (numeric value or measurement word)
 * - AND at least one action verb from the recipe verb set
 *
 * @param text - The text to analyze (e.g., a TikTok caption or transcript)
 * @returns true if the text contains recipe content, false otherwise
 */
export function hasRecipeContent(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  return hasIngredientQuantity(text) && hasActionVerb(text);
}
