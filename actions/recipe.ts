"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { recipes, cookbookEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { validateRecipeEdit } from "@/lib/validation";
import { createError } from "@/lib/errors";
import type { AppError } from "@/lib/errors";
import type { RecipeEditInput } from "@/lib/schemas";
import type { Ingredient } from "@/lib/types";

export type UpdateRecipeResult =
  | {
      success: true;
      recipe: {
        id: string;
        title: string;
        ingredients: Ingredient[];
        steps: string[];
      };
    }
  | { error: AppError };

export async function updateRecipe(
  recipeId: string,
  data: RecipeEditInput
): Promise<UpdateRecipeResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return {
      error: createError("UNAUTHORIZED", "You must be signed in to edit recipes"),
    };
  }

  // Validate input
  const validation = validateRecipeEdit(data);
  if (!validation.valid) {
    return {
      error: createError(
        "VALIDATION_ERROR",
        "Invalid recipe data",
        validation.errors
      ),
    };
  }

  // Verify user has this recipe in their cookbook (ownership check)
  const [entry] = await db
    .select({ id: cookbookEntries.id })
    .from(cookbookEntries)
    .where(
      and(
        eq(cookbookEntries.userId, session.user.id),
        eq(cookbookEntries.recipeId, recipeId)
      )
    );

  if (!entry) {
    return {
      error: createError(
        "NOT_FOUND",
        "Recipe not found in your cookbook"
      ),
    };
  }

  // Persist changes
  const [updated] = await db
    .update(recipes)
    .set({
      title: data.title,
      ingredients: data.ingredients as Ingredient[],
      steps: data.steps,
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, recipeId))
    .returning({
      id: recipes.id,
      title: recipes.title,
      ingredients: recipes.ingredients,
      steps: recipes.steps,
      slug: recipes.slug,
    });

  if (!updated) {
    return {
      error: createError("NOT_FOUND", "Recipe not found"),
    };
  }

  // Update tags on the cookbook entry if provided
  if (data.tags) {
    await db
      .update(cookbookEntries)
      .set({ tags: data.tags })
      .where(
        and(
          eq(cookbookEntries.userId, session.user.id),
          eq(cookbookEntries.recipeId, recipeId)
        )
      );
  }

  // Revalidate recipe page and cookbook
  revalidatePath(`/recipe/${recipeId}`);
  revalidatePath(`/r/${updated.slug}`);
  revalidatePath("/cookbook");

  return {
    success: true,
    recipe: {
      id: updated.id,
      title: updated.title,
      ingredients: updated.ingredients,
      steps: updated.steps,
    },
  };
}
