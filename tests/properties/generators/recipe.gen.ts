import fc from "fast-check";

/**
 * Shared fast-check generators (arbitraries) for recipe objects.
 * Aligned with the Zod schemas in lib/schemas.ts and types in lib/types.ts.
 *
 * Validates: Requirements 3.1
 */

// Generate ingredient names (non-empty, max 100 chars)
export const ingredientName = fc.string({ minLength: 1, maxLength: 100 });

// Generate quantity strings (always present, empty string if unknown)
export const ingredientQuantity = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.constant("")
);

// Generate unit strings (always present, empty string if unknown)
export const ingredientUnit = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.constant("")
);

// Generate a single ingredient object matching the Zod ingredientSchema
export const ingredient = fc.record({
  name: ingredientName,
  quantity: ingredientQuantity,
  unit: ingredientUnit,
});

// Generate recipe titles: non-empty, max 200 chars
export const recipeTitle = fc.string({ minLength: 1, maxLength: 200 });

// Generate recipe steps: non-empty strings, 1-30 items
export const recipeStep = fc.string({ minLength: 1, maxLength: 500 });
export const recipeSteps = fc.array(recipeStep, { minLength: 1, maxLength: 30 });

// Generate ingredients list: 1-20 items
export const recipeIngredients = fc.array(ingredient, {
  minLength: 1,
  maxLength: 20,
});

// Generate tipsAndTricks: array of strings (can be empty)
export const recipeTipsAndTricks = fc.array(fc.string({ minLength: 1, maxLength: 200 }), {
  minLength: 0,
  maxLength: 5,
});

// Generate a valid recipe object matching the Zod recipeSchema
export const validRecipe = fc.record({
  title: recipeTitle,
  ingredients: recipeIngredients,
  steps: recipeSteps,
  tipsAndTricks: recipeTipsAndTricks,
});

// Generate invalid recipe objects (missing required fields or violating constraints)
export const invalidRecipeTitle = fc.oneof(
  fc.constant(""), // empty title
  fc.string({ minLength: 201, maxLength: 300 }) // title too long
);

export const emptyIngredients = fc.constant(
  [] as { name: string; quantity: string; unit: string }[]
);

export const emptySteps = fc.constant([] as string[]);

// Generate an ingredient with an empty name (invalid per schema)
export const invalidIngredient = fc.record({
  name: fc.constant(""),
  quantity: ingredientQuantity,
  unit: ingredientUnit,
});
