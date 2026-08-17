import { db } from "@/db";
import { creatorOptOuts } from "@/db/schema";
import { isNull } from "drizzle-orm";

let optOutCache: { handles: Set<string>; fetchedAt: number } | null = null;
const MAX_STALENESS_MS = 5 * 60 * 1000; // 5 minutes

export async function isCreatorOptedOut(handle: string): Promise<boolean> {
  const cache = await getOptOutCache();
  return cache.has(handle.toLowerCase());
}

async function getOptOutCache(): Promise<Set<string>> {
  const now = Date.now();

  if (optOutCache && now - optOutCache.fetchedAt < MAX_STALENESS_MS) {
    return optOutCache.handles;
  }

  try {
    const rows = await db
      .select({ handle: creatorOptOuts.handle })
      .from(creatorOptOuts)
      .where(isNull(creatorOptOuts.reversedAt));

    optOutCache = {
      handles: new Set(rows.map((r) => r.handle.toLowerCase())),
      fetchedAt: now,
    };
    return optOutCache.handles;
  } catch (error) {
    // If DB unavailable, use stale cache (Requirement 11.5)
    if (optOutCache) return optOutCache.handles;
    throw error;
  }
}

export function invalidateOptOutCache(): void {
  optOutCache = null;
}
