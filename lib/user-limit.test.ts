/**
 * Unit tests for per-user rate limiting.
 *
 * DB layer mocked the same way lib/credits.test.ts does it: these assert on
 * what tryConsumeUserAction does with the count it reads, not on real window
 * behavior (that would need a real clock/database).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

import {
  tryConsumeUserAction,
  getUserActionCount,
  recordUserAction,
} from "./user-limit";
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

describe("getUserActionCount", () => {
  it("returns the number of matching rows", async () => {
    mockActionCount(5);
    await expect(getUserActionCount("user-1", "extraction_submit")).resolves.toBe(5);
  });

  it("returns 0 when no attempts are recorded", async () => {
    mockActionCount(0);
    await expect(getUserActionCount("user-1", "transcribe")).resolves.toBe(0);
  });
});

describe("recordUserAction", () => {
  it("inserts one row with the userId and action", async () => {
    const valuesMock = mockInsert();

    await recordUserAction("user-1", "transcribe");

    expect(valuesMock).toHaveBeenCalledWith({
      userId: "user-1",
      action: "transcribe",
    });
  });
});

describe("tryConsumeUserAction", () => {
  it("records the attempt and returns true when under the limit", async () => {
    mockActionCount(2);
    const valuesMock = mockInsert();

    const result = await tryConsumeUserAction("user-1", "transcribe");

    expect(result).toBe(true);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it("does not record, and returns false, once the limit is reached", async () => {
    // transcribe's cap is 10 — see LIMITS in user-limit.ts.
    mockActionCount(10);
    const valuesMock = mockInsert();

    const result = await tryConsumeUserAction("user-1", "transcribe");

    expect(result).toBe(false);
    // A rejected attempt must not itself consume a slot in the window.
    expect(valuesMock).not.toHaveBeenCalled();
  });

  it("uses a higher limit for extraction_submit than transcribe", async () => {
    mockActionCount(10);
    mockInsert();

    // 10 attempts already made: still under extraction_submit's cap (30),
    // but at transcribe's cap (10).
    const extractionResult = await tryConsumeUserAction("user-1", "extraction_submit");
    const transcribeResult = await tryConsumeUserAction("user-1", "transcribe");

    expect(extractionResult).toBe(true);
    expect(transcribeResult).toBe(false);
  });
});
