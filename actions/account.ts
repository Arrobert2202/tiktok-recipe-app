"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { createError } from "@/lib/errors";
import type { AppError } from "@/lib/errors";

export type DeleteAccountResult = { success: true } | { error: AppError };

/**
 * Permanently deletes the signed-in user's account (GDPR Art. 17).
 *
 * One statement does the work: `DELETE FROM users WHERE id = <session user>`.
 * Everything user-owned hangs off that row with `ON DELETE CASCADE`, so the
 * database removes it as part of the same statement:
 *
 *   session            → the user's login sessions
 *   account            → the linked OAuth provider records
 *   cookbook_entries   → saved recipes and their tags
 *   extraction_jobs    → extraction history
 *
 * `recipes` is deliberately untouched. It has no owner column — extracted
 * recipes are shared, cached content that other users' cookbooks reference, and
 * no foreign key points from `users` to `recipes`. The one link between the two
 * subtrees is `extraction_jobs.result_recipe_id → recipes.id`, which points job
 * → recipe, so deleting jobs cannot pull recipes along with them. `recipe_cache`
 * hangs off `recipes`, not off `users`, so it is unaffected too.
 *
 * The delete runs inside a transaction. A single statement is already atomic, but
 * the transaction is what guarantees that if any part of the cascade fails the
 * whole thing rolls back, rather than leaving a half-destroyed account behind.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return {
      error: createError(
        "UNAUTHORIZED",
        "You must be signed in to delete your account"
      ),
    };
  }

  // Captured once, from the server-side session only. Never from client input,
  // and every statement below is filtered by it — an unscoped delete here would
  // wipe the table.
  const userId = session.user.id;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.id, userId));
    });
  } catch (error) {
    console.error(`[deleteAccount] deletion failed for user ${userId}:`, error);
    return {
      error: createError(
        "DELETE_FAILED",
        "We couldn't delete your account. Please try again, or email robertaron993@gmail.com and we'll do it for you."
      ),
    };
  }

  return { success: true };
}
