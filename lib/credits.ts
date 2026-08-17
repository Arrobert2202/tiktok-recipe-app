import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Get the current credit count for a user.
 */
export async function getUserCredits(userId: string): Promise<number> {
  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId));
  return user?.credits ?? 0;
}

/**
 * Decrement a user's credits by 1. Returns the new credit count.
 * Only decrements if credits > 0.
 */
export async function decrementCredits(userId: string): Promise<number> {
  const [updated] = await db
    .update(users)
    .set({ credits: sql`${users.credits} - 1` })
    .where(eq(users.id, userId))
    .returning({ credits: users.credits });
  return updated?.credits ?? 0;
}

/**
 * Refund 1 credit to a user. Returns the new credit count.
 *
 * Mirrors `decrementCredits`: the arithmetic happens DB-side via a `sql`
 * expression, so it is a single atomic UPDATE rather than a read-modify-write
 * that could lose a concurrent change.
 *
 * There is deliberately no upper cap here. Credits are expected to grow through
 * purchases later, so clamping the column would fight that. Protection against
 * runaway balances comes from the *caller* instead: the extraction job claims a
 * one-shot `creditRefunded` flag on the job row before calling this, which makes
 * the refund exactly-once per job even if the failure handler runs repeatedly.
 */
export async function refundCredit(userId: string): Promise<number> {
  const [updated] = await db
    .update(users)
    .set({ credits: sql`${users.credits} + 1` })
    .where(eq(users.id, userId))
    .returning({ credits: users.credits });
  return updated?.credits ?? 0;
}

/**
 * Check if a user has credits available.
 */
export async function hasCredits(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);
  return credits > 0;
}
