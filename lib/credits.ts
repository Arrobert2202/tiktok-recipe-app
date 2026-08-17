import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

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
 * Atomically claims 1 credit for a user. Returns the new balance, or `null`
 * if the user had no credits to claim.
 *
 * The guard lives in the WHERE clause of a single UPDATE, the same pattern
 * `refundCreditForFailedJob` uses for the refund side: the database decides
 * who wins under concurrent submissions, rather than an application-side
 * check-then-act. A prior version split this into `hasCredits()` followed by
 * a separate `decrementCredits()`, which left a window where two concurrent
 * requests could both read a positive balance and both decrement, driving
 * the balance negative.
 *
 * Returning `null` on failure (rather than throwing) lets a caller distinguish
 * "charged" from "no credits left" without a second query.
 */
export async function claimCredit(userId: string): Promise<number | null> {
  const [claimed] = await db
    .update(users)
    .set({ credits: sql`${users.credits} - 1` })
    .where(and(eq(users.id, userId), gt(users.credits, 0)))
    .returning({ credits: users.credits });
  return claimed?.credits ?? null;
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
