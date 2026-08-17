"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { cookbookEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { validateTags } from "@/lib/validation";
import { createError } from "@/lib/errors";
import type { AppError } from "@/lib/errors";

export type ActionResult = { success: true } | { error: AppError };

export async function saveRecipeToCookbook(
  recipeId: string
): Promise<ActionResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return {
      error: createError("UNAUTHORIZED", "You must be signed in to save recipes"),
    };
  }

  const result = await db
    .insert(cookbookEntries)
    .values({
      userId: session.user.id,
      recipeId,
    })
    .onConflictDoNothing({
      target: [cookbookEntries.userId, cookbookEntries.recipeId],
    })
    .returning({ id: cookbookEntries.id });

  if (result.length === 0) {
    return {
      error: createError(
        "ALREADY_SAVED",
        "Recipe is already in your cookbook"
      ),
    };
  }

  return { success: true };
}

export async function removeRecipeFromCookbook(
  recipeId: string
): Promise<ActionResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return {
      error: createError(
        "UNAUTHORIZED",
        "You must be signed in to remove recipes"
      ),
    };
  }

  await db
    .delete(cookbookEntries)
    .where(
      and(
        eq(cookbookEntries.userId, session.user.id),
        eq(cookbookEntries.recipeId, recipeId)
      )
    );

  revalidatePath("/cookbook");

  return { success: true };
}

export async function updateRecipeTags(
  recipeId: string,
  tags: string[]
): Promise<ActionResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return {
      error: createError(
        "UNAUTHORIZED",
        "You must be signed in to update tags"
      ),
    };
  }

  // Validate tags (each 1-50 chars, max 20 total)
  const validation = validateTags(tags);
  if (!validation.valid) {
    return {
      error: createError("VALIDATION_ERROR", "Invalid tags", validation.errors),
    };
  }

  await db
    .update(cookbookEntries)
    .set({ tags })
    .where(
      and(
        eq(cookbookEntries.userId, session.user.id),
        eq(cookbookEntries.recipeId, recipeId)
      )
    );

  revalidatePath("/cookbook");

  return { success: true };
}
