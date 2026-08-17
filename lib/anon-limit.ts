/**
 * Rate limiting for anonymous ("try one free") extractions.
 *
 * Client IPs are never stored raw — only a salted SHA-256 hash, which is
 * sufficient for abuse prevention and strictly better for privacy.
 */

import { createHash } from "node:crypto";
import { db } from "@/db";
import { anonymousExtractions } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

/** Free anonymous extractions allowed per IP per 24 hours. */
export const ANON_FREE_EXTRACTIONS = 1;

const WINDOW_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SALT = "recipeapp-anon-salt";

/**
 * Hashes a client IP with a server-side salt.
 * The same IP always maps to the same hash for a given salt, so counting works,
 * but the original address cannot be recovered from the stored value.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? DEFAULT_SALT;
  return createHash("sha256").update(ip + salt).digest("hex");
}

/**
 * Counts anonymous extractions recorded for this IP hash in the last 24 hours.
 */
export async function getAnonExtractionCount(ipHash: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);

  const rows = await db
    .select({ id: anonymousExtractions.id })
    .from(anonymousExtractions)
    .where(
      and(
        eq(anonymousExtractions.ipHash, ipHash),
        gte(anonymousExtractions.createdAt, since)
      )
    );

  return rows.length;
}

/**
 * Records a consumed anonymous extraction against an IP hash.
 */
export async function recordAnonExtraction(
  ipHash: string,
  canonicalUrl: string
): Promise<void> {
  await db.insert(anonymousExtractions).values({ ipHash, canonicalUrl });
}

/**
 * Resolves the client IP from request headers.
 *
 * `x-forwarded-for` is a comma-separated chain where the FIRST entry is the
 * originating client and later entries are proxies — Vercel sets this header.
 * Falls back to `x-real-ip`, then the literal "unknown" so hashing never
 * receives an empty value.
 */
export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
