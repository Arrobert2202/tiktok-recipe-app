import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

import { isCreatorOptedOut, invalidateOptOutCache } from "./opt-out-cache";
import { db } from "@/db";

/**
 * Stubs db.select for both query shapes getOptOutCache issues:
 *   - the main handle-list fetch: .select({handle}).from().where() → rows
 *   - the marker check: .select({maxUpdatedAt}).from() → [{maxUpdatedAt}]
 *     (no .where() at all — it's an unconditional aggregate)
 *
 * .from() returns an object that's both awaitable directly (resolving to
 * the marker row, satisfying the second shape) and exposes .where()
 * (resolving to the handle rows, satisfying the first) — whichever the
 * calling code actually uses determines which one takes effect.
 */
function mockDbQuery(handleRows: { handle: string }[], markerUpdatedAt: Date | null = null) {
  const fromResult = {
    where: vi.fn().mockResolvedValue(handleRows),
    then: (resolve: (v: unknown) => void) => resolve([{ maxUpdatedAt: markerUpdatedAt }]),
  };
  const chain = { from: vi.fn().mockReturnValue(fromResult) };
  vi.mocked(db.select).mockReturnValue(chain as never);
  return chain;
}

/**
 * Walks a drizzle SQL tree and collects every column name it references —
 * used instead of JSON.stringify, since real column/table objects are
 * circular (a column points back to its table, which points back to its
 * columns) and JSON.stringify throws on that.
 */
function collectColumnNames(node: unknown, out: string[] = []): string[] {
  const n = node as { name?: string; queryChunks?: unknown[] };
  if (n && typeof n === "object") {
    if (typeof n.name === "string") out.push(n.name);
    if (Array.isArray(n.queryChunks)) {
      for (const chunk of n.queryChunks) collectColumnNames(chunk, out);
    }
  }
  return out;
}

function mockDbQueryError(error: Error) {
  const fromResult = {
    where: vi.fn().mockRejectedValue(error),
    then: (_resolve: unknown, reject: (e: unknown) => void) => reject(error),
  };
  const chain = { from: vi.fn().mockReturnValue(fromResult) };
  vi.mocked(db.select).mockReturnValue(chain as never);
  return chain;
}

describe("opt-out-cache", () => {
  beforeEach(() => {
    invalidateOptOutCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isCreatorOptedOut", () => {
    it("returns true for an opted-out creator", async () => {
      mockDbQuery([{ handle: "creator1" }, { handle: "creator2" }]);

      const result = await isCreatorOptedOut("creator1");
      expect(result).toBe(true);
    });

    it("returns false for a creator not in the opt-out list", async () => {
      mockDbQuery([{ handle: "creator1" }]);

      const result = await isCreatorOptedOut("other_creator");
      expect(result).toBe(false);
    });

    it("performs case-insensitive comparison", async () => {
      mockDbQuery([{ handle: "CreatorMixed" }]);

      expect(await isCreatorOptedOut("creatormixed")).toBe(true);
      expect(await isCreatorOptedOut("CREATORMIXED")).toBe(true);
      expect(await isCreatorOptedOut("CreatorMixed")).toBe(true);
    });

    it("only counts verified, non-reversed rows (excludes unverified-pending requests)", async () => {
      const chain = mockDbQuery([{ handle: "creator1" }]);

      await isCreatorOptedOut("creator1");

      // The WHERE clause has to guard on verifiedAt, not just reversedAt —
      // otherwise a submitted-but-never-confirmed request (reversedAt is
      // also null for those, since they were never active) would wrongly
      // read as opted out.
      const whereClause = chain.from.mock.results[0].value.where.mock.calls[0][0];
      const columns = collectColumnNames(whereClause);
      expect(columns).toContain("verified_at");
      expect(columns).toContain("reversed_at");
    });
  });

  describe("caching behavior", () => {
    it("returns cached result without querying db on subsequent calls within the marker-check interval", async () => {
      mockDbQuery([{ handle: "creator1" }]);

      await isCreatorOptedOut("creator1");
      await isCreatorOptedOut("creator1");
      await isCreatorOptedOut("creator1");

      // The first call does a full fetch: the handle list, plus one query
      // to establish the marker baseline for future freshness checks. The
      // second and third calls are inside both the 5-minute TTL and the
      // 30-second marker-check interval, so they're fully cached — no
      // db.select at all.
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it("refreshes cache after staleness period expires", async () => {
      mockDbQuery([{ handle: "creator1" }]);
      await isCreatorOptedOut("creator1");

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);

      mockDbQuery([{ handle: "creator1" }, { handle: "creator2" }]);
      const result = await isCreatorOptedOut("creator2");

      expect(result).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("cross-instance invalidation via the updatedAt marker", () => {
    it("forces an early refetch when the marker has advanced past what this process last saw", async () => {
      mockDbQuery([{ handle: "creator1" }], new Date("2026-01-01T00:00:00Z"));
      await isCreatorOptedOut("creator1"); // fetch #1: populates the cache

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 31 * 1000); // past the 30s marker interval, well under the 5min TTL

      // Simulates a different instance having confirmed an opt-out for
      // creator2 in between — the marker is now newer than what this
      // process saw on the previous call.
      mockDbQuery(
        [{ handle: "creator1" }, { handle: "creator2" }],
        new Date("2026-01-01T00:00:31Z")
      );

      const result = await isCreatorOptedOut("creator2");

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("does not refetch when the marker is unchanged", async () => {
      const staticMarker = new Date("2026-01-01T00:00:00Z");
      mockDbQuery([{ handle: "creator1" }], staticMarker);
      await isCreatorOptedOut("creator1"); // fetch #1

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 31 * 1000);

      mockDbQuery([{ handle: "creator1" }], staticMarker);
      await isCreatorOptedOut("creator1"); // marker check #1: primes lastSeenMarker, no refetch

      vi.setSystemTime(Date.now() + 31 * 1000);
      const callsBefore = vi.mocked(db.select).mock.calls.length;
      mockDbQuery([{ handle: "creator1" }], staticMarker);
      await isCreatorOptedOut("creator1"); // marker check #2: same marker, no refetch

      // Only the marker query ran, not a full handle-list refetch.
      expect(vi.mocked(db.select).mock.calls.length).toBe(callsBefore + 1);

      vi.useRealTimers();
    });
  });

  describe("stale cache fallback", () => {
    it("uses stale cache when database is unavailable on refresh", async () => {
      mockDbQuery([{ handle: "creator1" }]);
      await isCreatorOptedOut("creator1");

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);

      mockDbQueryError(new Error("Connection refused"));

      const result = await isCreatorOptedOut("creator1");
      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("throws error when db fails and no stale cache exists", async () => {
      mockDbQueryError(new Error("Connection refused"));

      await expect(isCreatorOptedOut("creator1")).rejects.toThrow(
        "Connection refused"
      );
    });

    it("keeps enforcing from cache when only the marker check fails", async () => {
      mockDbQuery([{ handle: "creator1" }], new Date());
      await isCreatorOptedOut("creator1"); // fetch #1

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 31 * 1000);

      // Marker check fails, but the main cache is still within its 5-minute
      // TTL — enforcement should be unaffected.
      const fromResult = {
        where: vi.fn().mockResolvedValue([{ handle: "creator1" }]),
        then: (_resolve: unknown, reject: (e: unknown) => void) =>
          reject(new Error("marker query failed")),
      };
      vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue(fromResult) } as never);

      const result = await isCreatorOptedOut("creator1");
      expect(result).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("invalidateOptOutCache", () => {
    it("forces a fresh database query on next call", async () => {
      mockDbQuery([{ handle: "creator1" }]);
      await isCreatorOptedOut("creator1");

      invalidateOptOutCache();

      mockDbQuery([{ handle: "creator1" }, { handle: "creator2" }]);
      const result = await isCreatorOptedOut("creator2");

      expect(result).toBe(true);
    });
  });
});
