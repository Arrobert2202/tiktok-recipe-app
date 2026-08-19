/**
 * Unit tests for per-IP rate limiting. Mirrors lib/user-limit.test.ts's
 * approach — DB layer mocked, asserting on how tryConsumeIpAction reacts to
 * the count it reads, not real window timing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

import { tryConsumeIpAction, getIpActionCount, recordIpAction } from "./ip-limit";
import { db } from "@/db";

function mockActionCount(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `row-${i}` }));
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never);
}

function mockInsert() {
  const valuesMock = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never);
  return valuesMock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getIpActionCount", () => {
  it("returns the number of matching rows", async () => {
    mockActionCount(3);
    await expect(getIpActionCount("hash-1", "creator_portal_submit")).resolves.toBe(3);
  });

  it("returns 0 when no attempts are recorded", async () => {
    mockActionCount(0);
    await expect(getIpActionCount("hash-1", "creator_portal_submit")).resolves.toBe(0);
  });
});

describe("recordIpAction", () => {
  it("inserts one row with the ipHash and action", async () => {
    const valuesMock = mockInsert();

    await recordIpAction("hash-1", "creator_portal_submit");

    expect(valuesMock).toHaveBeenCalledWith({ ipHash: "hash-1", action: "creator_portal_submit" });
  });
});

describe("tryConsumeIpAction", () => {
  it("records the attempt and returns true when under the limit", async () => {
    mockActionCount(2);
    const valuesMock = mockInsert();

    const result = await tryConsumeIpAction("hash-1", "creator_portal_submit");

    expect(result).toBe(true);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it("does not record, and returns false, once the limit is reached", async () => {
    // creator_portal_submit's cap is 5 — see LIMITS in ip-limit.ts.
    mockActionCount(5);
    const valuesMock = mockInsert();

    const result = await tryConsumeIpAction("hash-1", "creator_portal_submit");

    expect(result).toBe(false);
    expect(valuesMock).not.toHaveBeenCalled();
  });
});
