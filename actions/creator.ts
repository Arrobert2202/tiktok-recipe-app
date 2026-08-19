"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { creatorOptOuts, recipes, recipeCache } from "@/db/schema";
import { eq, and, gt, inArray, sql } from "drizzle-orm";
import { validateTikTokHandle } from "@/lib/validation";
import { hashIp, extractClientIp } from "@/lib/anon-limit";
import { tryConsumeIpAction } from "@/lib/ip-limit";
import { generateVerificationToken } from "@/lib/verification-token";
import { sendCreatorVerificationEmail } from "@/lib/email";
import { invalidateOptOutCache } from "@/lib/opt-out-cache";

export interface OptOutResult {
  success: boolean;
  error?: string;
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isValidEmail(email: string): boolean {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildVerifyUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/creators/verify?token=${encodeURIComponent(token)}`;
}

/**
 * Rate-limits the creator portal by hashed IP — this form is open to
 * anyone, unauthenticated, and a successful submission sends real email.
 */
async function withinRateLimit(): Promise<boolean> {
  const requestHeaders = await headers();
  const ipHash = hashIp(extractClientIp(requestHeaders));
  return tryConsumeIpAction(ipHash, "creator_portal_submit");
}

/**
 * Submit a creator opt-out request. Does not opt anyone out by itself — it
 * emails a confirmation link, and only clicking that (confirmCreatorAction)
 * actually flips anything. Requirement 10.1's "identity verification step."
 */
export async function submitOptOutRequest(
  handle: string,
  email: string
): Promise<OptOutResult> {
  if (!validateTikTokHandle(handle)) {
    return {
      success: false,
      error:
        "Invalid TikTok handle. Must be 1-24 characters using only letters, numbers, and underscores.",
    };
  }

  if (!isValidEmail(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (!(await withinRateLimit())) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  // Normalized because recipes.creatorHandle isn't consistently cased at
  // the source (lib/url.ts's extractCreatorHandle doesn't lowercase), so
  // this table has to canonicalize on its own side to stay a reliable
  // one-row-per-real-creator lookup.
  const normalizedHandle = handle.toLowerCase();

  const [existing] = await db
    .select()
    .from(creatorOptOuts)
    .where(eq(creatorOptOuts.handle, normalizedHandle));

  // Already active: nothing to do, and critically, don't touch `email`.
  // Resubmitting an already-opted-out handle with a different email must
  // not silently change who controls it — that would let anyone hijack an
  // existing opt-out by resubmitting with their own address, then pass
  // reverseOptOut's email-match check to reverse a real creator's opt-out.
  if (existing?.verifiedAt && !existing.reversedAt) {
    return { success: true };
  }

  const token = generateVerificationToken();
  const pendingTokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  if (existing) {
    await db
      .update(creatorOptOuts)
      .set({ email, pendingToken: token, pendingAction: "opt_out", pendingTokenExpiresAt })
      .where(eq(creatorOptOuts.id, existing.id));
  } else {
    await db.insert(creatorOptOuts).values({
      handle: normalizedHandle,
      email,
      pendingToken: token,
      pendingAction: "opt_out",
      pendingTokenExpiresAt,
    });
  }

  await sendCreatorVerificationEmail({
    to: email,
    handle: normalizedHandle,
    action: "opt_out",
    verifyUrl: buildVerifyUrl(token),
  });

  return { success: true };
}

/**
 * Reverse a creator opt-out. Requirement 10.6: needs the same identity
 * verification step as opting out, not just resubmitting the form.
 */
export async function reverseOptOut(
  handle: string,
  email: string
): Promise<OptOutResult> {
  if (!validateTikTokHandle(handle)) {
    return {
      success: false,
      error:
        "Invalid TikTok handle. Must be 1-24 characters using only letters, numbers, and underscores.",
    };
  }

  if (!isValidEmail(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (!(await withinRateLimit())) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const normalizedHandle = handle.toLowerCase();

  const [existing] = await db
    .select()
    .from(creatorOptOuts)
    .where(eq(creatorOptOuts.handle, normalizedHandle));

  // Reversal is only honored for the email that originally opted the
  // handle out — the one identity check available here without TikTok
  // account access, so it's the one that gates changing the decision back.
  const eligible =
    !!existing &&
    !!existing.verifiedAt &&
    !existing.reversedAt &&
    existing.email.toLowerCase() === email.toLowerCase();

  if (!eligible) {
    // Same response as success, whether the handle doesn't exist, isn't
    // currently opted out, or the email doesn't match — so this form can't
    // be used to probe which case applies. The real branch below makes a
    // network call to Resend; matching that rough cost here keeps response
    // timing from leaking which branch actually ran (an imperfect but cheap
    // mitigation — network jitter still leaks some signal either way).
    await sleep(300);
    return { success: true };
  }

  const token = generateVerificationToken();
  const pendingTokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db
    .update(creatorOptOuts)
    .set({ pendingToken: token, pendingAction: "reverse", pendingTokenExpiresAt })
    .where(eq(creatorOptOuts.id, existing.id));

  await sendCreatorVerificationEmail({
    to: existing.email,
    handle: normalizedHandle,
    action: "reverse",
    verifyUrl: buildVerifyUrl(token),
  });

  return { success: true };
}

export type ConfirmResult =
  | { success: true; action: "opt_out" | "reverse"; handle: string }
  | { success: false; error: string };

/**
 * Claims and applies a confirmation token from an opt-out or reversal
 * email. Called from a button on app/creators/verify/page.tsx, not on that
 * page's initial GET — email clients and security scanners routinely
 * pre-fetch links in incoming mail, which would silently burn a one-click
 * token before the creator ever opens the message if confirming happened
 * on page load instead of on an explicit click.
 *
 * The claim is a SELECT ... FOR UPDATE inside a transaction rather than a
 * single UPDATE ... RETURNING: RETURNING always reflects the row *after*
 * the update, and this statement has to null pendingAction as part of
 * clearing it, so a single UPDATE can't also report back which action was
 * pending. The row lock gives the same protection against a token being
 * claimed twice (a replay, or two near-simultaneous clicks) that an atomic
 * UPDATE would — a second transaction blocks until the first commits, then
 * finds pendingToken already cleared and matches nothing.
 */
export async function confirmCreatorAction(token: string): Promise<ConfirmResult> {
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(creatorOptOuts)
      .where(
        and(eq(creatorOptOuts.pendingToken, token), gt(creatorOptOuts.pendingTokenExpiresAt, new Date()))
      )
      .for("update");

    if (!row) {
      return null;
    }

    const now = new Date();
    const action = row.pendingAction as "opt_out" | "reverse";

    if (action === "opt_out") {
      await tx
        .update(creatorOptOuts)
        .set({
          pendingToken: null,
          pendingAction: null,
          pendingTokenExpiresAt: null,
          verifiedAt: now,
          optedOutAt: now,
          reversedAt: null, // covers re-opting-out after a prior reversal
          updatedAt: now,
        })
        .where(eq(creatorOptOuts.id, row.id));

      await tx
        .update(recipes)
        .set({ isPublic: false })
        .where(sql`lower(${recipes.creatorHandle}) = ${row.handle}`);

      // Case-insensitive match, same reasoning as the recipes update above:
      // recipes aren't guaranteed to have creatorHandle in the same casing
      // as this table's normalized handle.
      const matching = await tx
        .select({ id: recipes.id })
        .from(recipes)
        .where(sql`lower(${recipes.creatorHandle}) = ${row.handle}`);
      if (matching.length > 0) {
        await tx.delete(recipeCache).where(
          inArray(recipeCache.recipeId, matching.map((r) => r.id))
        );
      }
    } else {
      await tx
        .update(creatorOptOuts)
        .set({
          pendingToken: null,
          pendingAction: null,
          pendingTokenExpiresAt: null,
          reversedAt: now,
          updatedAt: now,
        })
        .where(eq(creatorOptOuts.id, row.id));

      await tx
        .update(recipes)
        .set({ isPublic: true })
        .where(sql`lower(${recipes.creatorHandle}) = ${row.handle}`);
      // No cache restoration needed — a cold recipe_cache just means the
      // next request for that URL re-extracts, which is always safe.
    }

    return { action, handle: row.handle };
  });

  if (!claimed) {
    return { success: false, error: "This link is invalid or has expired." };
  }

  invalidateOptOutCache();

  return { success: true, action: claimed.action, handle: claimed.handle };
}
