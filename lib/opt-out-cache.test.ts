import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module before importing the module under test
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  creatorOptOuts: {
    handle: "handle",
    reversedAt: "reversed_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  isNull: vi.fn((col: string) => `${col} IS NULL`),
}));

import { isCreatorOptedOut, invalidateOptOutCache } from "./opt-out-cache";
import { db } from "@/db";

function mockDbQuery(rows: { handle: string }[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockDbQueryError(error: Error) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockRejectedValue(error),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
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
  });

  describe("caching behavior", () => {
    it("returns cached result without querying db on subsequent calls", async () => {
      mockDbQuery([{ handle: "creator1" }]);

      await isCreatorOptedOut("creator1");
      await isCreatorOptedOut("creator1");
      await isCreatorOptedOut("creator1");

      // db.select should only be called once
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it("refreshes cache after staleness period expires", async () => {
      mockDbQuery([{ handle: "creator1" }]);
      await isCreatorOptedOut("creator1");

      // Advance time past MAX_STALENESS_MS (5 minutes)
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);

      mockDbQuery([{ handle: "creator1" }, { handle: "creator2" }]);
      const result = await isCreatorOptedOut("creator2");

      expect(result).toBe(true);
      expect(db.select).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe("stale cache fallback", () => {
    it("uses stale cache when database is unavailable on refresh", async () => {
      // First call populates the cache
      mockDbQuery([{ handle: "creator1" }]);
      await isCreatorOptedOut("creator1");

      // Advance time past staleness
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);

      // DB fails on refresh attempt
      mockDbQueryError(new Error("Connection refused"));

      // Should still return the stale cached value
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
  });

  describe("invalidateOptOutCache", () => {
    it("forces a fresh database query on next call", async () => {
      mockDbQuery([{ handle: "creator1" }]);
      await isCreatorOptedOut("creator1");

      invalidateOptOutCache();

      mockDbQuery([{ handle: "creator1" }, { handle: "creator2" }]);
      const result = await isCreatorOptedOut("creator2");

      expect(result).toBe(true);
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });
});
