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

  // Ownership check. `recipes` has no per-user copies — this is the single
  // shared row `/r/[slug]` and every saver's cookbook read from, so editing
  // it has to be restricted to whoever actually owns it, not just anyone
  // who saved it. A `NULL` owner (anonymous-path recipes, or ones from
  // before this column existed and couldn't be backfilled) rejects
  // everyone rather than defaulting open.
  const [updated] = await db
    .update(recipes)
    .set({
      title: data.title,
      ingredients: data.ingredients as Ingredient[],
      steps: data.steps,
      updatedAt: new Date(),
    })
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, session.user.id)))
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
