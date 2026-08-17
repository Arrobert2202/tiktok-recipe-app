import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().min(1).describe("The ingredient name"),
  quantity: z.string().describe("The quantity amount, e.g. '2', '1/2', 'a handful'. Use empty string if unknown."),
  unit: z.string().describe("The unit of measurement, e.g. 'cups', 'tbsp', 'pieces'. Use empty string if unknown."),
});

export const recipeSchema = z.object({
  title: z.string().min(1).max(200).describe("A clear, descriptive recipe title"),
  ingredients: z.array(ingredientSchema).min(1).describe("List of all ingredients"),
  steps: z.array(z.string().min(1)).min(1).describe("Ordered preparation steps"),
  tipsAndTricks: z.array(z.string()).describe(
    "Chef secrets, resting times, pro-tips, or techniques mentioned that improve the recipe outcome. Empty array if none found."
  ),
});

export const recipeEditSchema = z.object({
  title: z.string().min(1).max(200),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
  tipsAndTricks: z.array(z.string()).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export type IngredientInput = z.infer<typeof ingredientSchema>;
export type RecipeInput = z.infer<typeof recipeSchema>;
export type RecipeEditInput = z.infer<typeof recipeEditSchema>;
