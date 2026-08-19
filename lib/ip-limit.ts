/**
 * Per-IP rate limiting for actions unauthenticated callers can trigger.
 *
 * Mirrors lib/user-limit.ts's shape (count-in-window, then record-on-
 * attempt) exactly, just keyed on a hashed IP instead of a userId — there's
 * no signed-in identity to key on for a form the creator portal exposes to
 * the open internet. Reuses lib/anon-limit.ts's hashIp/extractClientIp
 * rather than duplicating them; that module's own table
 * (anonymous_extractions) is deliberately not reused here, since it
 * specifically tracks the free-extraction allowance, a different concern.
 */

import { db } from "@/db";
import { ipActionLimits } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

/** Actions this module tracks limits for. */
export type LimitedIpAction = "creator_portal_submit";

const WINDOW_MS = 60 * 60 * 1000;

const LIMITS: Record<LimitedIpAction, number> = {
  // The creator portal sends real email per successful submission. This
  // caps that regardless of how many distinct handles a single IP tries —
  // generous enough for a creator retrying a typo'd email, tight enough
  // that it isn't a free way to make this app send email on request.
  creator_portal_submit: 5,
};

/**
 * Counts attempts recorded for an IP hash at `action` in the last hour.
 */
export async function getIpActionCount(
  ipHash: string,
  action: LimitedIpAction
): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);

  const rows = await db
    .select({ id: ipActionLimits.id })
    .from(ipActionLimits)
    .where(
      and(
        eq(ipActionLimits.ipHash, ipHash),
        eq(ipActionLimits.action, action),
        gte(ipActionLimits.createdAt, since)
      )
    );

  return rows.length;
}

/**
 * Records an attempt at `action` for an IP hash.
 */
export async function recordIpAction(
  ipHash: string,
  action: LimitedIpAction
): Promise<void> {
  await db.insert(ipActionLimits).values({ ipHash, action });
}

/**
 * Checks whether an IP is under its hourly limit for `action`, and records
 * the attempt if so. Returns false (without recording) when the limit is
 * already reached, so a rejected attempt doesn't itself count against the
 * window.
 */
export async function tryConsumeIpAction(
  ipHash: string,
  action: LimitedIpAction
): Promise<boolean> {
  const count = await getIpActionCount(ipHash, action);
  if (count >= LIMITS[action]) {
    return false;
  }
  await recordIpAction(ipHash, action);
  return true;
}
