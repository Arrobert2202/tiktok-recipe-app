/**
 * Per-user rate limiting for authenticated actions that cost money.
 *
 * Mirrors lib/anon-limit.ts's shape (count-in-window, then record-on-attempt),
 * but keyed on the authenticated userId directly rather than a hashed IP —
 * there's no privacy reason to hash an identifier the user already gave us by
 * signing in.
 */

import { db } from "@/db";
import { userActionLimits } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

/** Actions this module tracks limits for. */
export type LimitedAction = "extraction_submit" | "transcribe";

const WINDOW_MS = 60 * 60 * 1000;

const LIMITS: Record<LimitedAction, number> = {
  // Generous: covers real retries and multiple legitimate submissions without
  // bothering normal use, while stopping scripted hammering of the parts of
  // the extraction pipeline (oEmbed fetch, cache/dedupe lookups) that run
  // before a credit is ever checked.
  extraction_submit: 30,
  // Tighter than extraction_submit: every call incurs a Whisper transcription
  // cost regardless of whether the user ever submits the resulting transcript
  // for extraction, so this is the one place a positive credit balance alone
  // doesn't cap spend.
  transcribe: 10,
};

/**
 * Counts a user's recorded attempts at `action` in the last hour.
 */
export async function getUserActionCount(
  userId: string,
  action: LimitedAction
): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);

  const rows = await db
    .select({ id: userActionLimits.id })
    .from(userActionLimits)
    .where(
      and(
        eq(userActionLimits.userId, userId),
        eq(userActionLimits.action, action),
        gte(userActionLimits.createdAt, since)
      )
    );

  return rows.length;
}

/**
 * Records an attempt at `action` for a user.
 */
export async function recordUserAction(
  userId: string,
  action: LimitedAction
): Promise<void> {
  await db.insert(userActionLimits).values({ userId, action });
}

/**
 * Checks whether a user is under their hourly limit for `action`, and records
 * the attempt if so. Returns false (without recording) when the limit is
 * already reached, so a rejected attempt doesn't itself count against the
 * window.
 */
export async function tryConsumeUserAction(
  userId: string,
  action: LimitedAction
): Promise<boolean> {
  const count = await getUserActionCount(userId, action);
  if (count >= LIMITS[action]) {
    return false;
  }
  await recordUserAction(userId, action);
  return true;
}
