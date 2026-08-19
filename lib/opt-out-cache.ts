import { db } from "@/db";
import { creatorOptOuts } from "@/db/schema";
import { and, isNull, isNotNull, max } from "drizzle-orm";

let optOutCache: { handles: Set<string>; fetchedAt: number } | null = null;
const MAX_STALENESS_MS = 5 * 60 * 1000; // 5 minutes

// Cross-instance freshness: a change confirmed on a different server
// instance bumps creatorOptOuts.updatedAt, and this process compares
// against that on a much shorter interval than the main TTL, so it doesn't
// have to wait out the full 5 minutes to notice.
let lastSeenMarker: number | null = null;
let markerCheckedAt = 0;
const MARKER_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

export async function isCreatorOptedOut(handle: string): Promise<boolean> {
  const cache = await getOptOutCache();
  return cache.has(handle.toLowerCase());
}

/**
 * Reads the current change marker directly — the freshest truth, not
 * cached. Used both to establish a baseline right after a full refetch and
 * by hasChangedSinceCache to test that baseline later.
 */
async function fetchMarker(): Promise<number | null> {
  const [row] = await db.select({ maxUpdatedAt: max(creatorOptOuts.updatedAt) }).from(creatorOptOuts);
  return row?.maxUpdatedAt ? new Date(row.maxUpdatedAt).getTime() : null;
}

async function getOptOutCache(): Promise<Set<string>> {
  const now = Date.now();

  if (optOutCache && now - optOutCache.fetchedAt < MAX_STALENESS_MS) {
    if (!(await hasChangedSinceCache(now))) {
      return optOutCache.handles;
    }
  }

  try {
    // Only verified, non-reversed rows count as actually opted out. An
    // unverified row (a submitted request nobody has confirmed yet) has
    // reversedAt = NULL too, since it was never active — matching on
    // reversedAt alone, as this used to, would wrongly block extraction
    // for a creator who merely had someone *submit* a request no one ever
    // confirmed.
    const rows = await db
      .select({ handle: creatorOptOuts.handle })
      .from(creatorOptOuts)
      .where(and(isNotNull(creatorOptOuts.verifiedAt), isNull(creatorOptOuts.reversedAt)));

    optOutCache = {
      handles: new Set(rows.map((r) => r.handle.toLowerCase())),
      fetchedAt: now,
    };

    // Establishes a real baseline for the next marker check, rather than
    // leaving it unset — otherwise a change in the ~30s immediately after
    // this fetch wouldn't be caught until the marker check *after* the
    // next one, since a null baseline treats the first check as priming
    // rather than comparing.
    markerCheckedAt = now;
    try {
      lastSeenMarker = await fetchMarker();
    } catch {
      lastSeenMarker = null;
    }

    return optOutCache.handles;
  } catch (error) {
    // If DB unavailable, use stale cache (Requirement 11.5)
    if (optOutCache) return optOutCache.handles;
    throw error;
  }
}

/**
 * Cheap, short-interval check for whether another instance has changed the
 * opt-out list since this process last fetched it.
 *
 * Deliberately not run on every call: a synchronous MAX() query on every
 * request would put a DB round-trip back on the extraction hot path
 * (Requirement 11.2's 500ms budget) for calls that previously never
 * touched the DB at all, and would need to duplicate 11.5's stale-fallback
 * behavior on its own. Gated behind its own interval — an order of
 * magnitude shorter than the main TTL, so propagation across instances is
 * bounded well under 5 minutes, but still cheap in the common case where
 * nothing has changed.
 */
async function hasChangedSinceCache(now: number): Promise<boolean> {
  if (now - markerCheckedAt < MARKER_CHECK_INTERVAL_MS) {
    return false;
  }
  markerCheckedAt = now;

  try {
    const marker = await fetchMarker();

    if (lastSeenMarker === null) {
      // First check this process has ever done — nothing to compare
      // against, and the cache we already hold came from a real fetch, so
      // there's nothing stale to correct yet.
      lastSeenMarker = marker;
      return false;
    }

    if (marker !== null && marker > lastSeenMarker) {
      lastSeenMarker = marker;
      return true;
    }
    return false;
  } catch {
    // A failed marker check shouldn't break enforcement — it just means no
    // new information this round. The main cache's own staleness and
    // DB-error handling still apply on top of this.
    return false;
  }
}

export function invalidateOptOutCache(): void {
  optOutCache = null;
  // A manual invalidation means the next real fetch establishes current
  // truth from scratch, so there's nothing meaningful left to compare a
  // future marker check against until that happens.
  lastSeenMarker = null;
  markerCheckedAt = 0;
}
