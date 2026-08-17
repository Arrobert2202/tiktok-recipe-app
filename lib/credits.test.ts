/**
 * Unit tests for the credit ledger helpers.
 *
 * The DB layer is mocked the same way the extraction integration test does it,
 * so these assert on the statement each helper *builds* — in particular that the
 * arithmetic is handed to the database as an expression rather than computed in
 * JS from a previously-read value. A read-modify-write here would silently drop
 * concurrent updates, which for a credit balance means either giving away free
 * extractions or eating a user's credit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

import { refundCredit, decrementCredits, getUserCredits, hasCredits } from "./credits";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Flattens a drizzle `sql` template into a comparable string, e.g.
 * sql`${users.credits} + 1` becomes "credits + 1".
 *
 * Column chunks expose `.name`; literal chunks expose `.value` as a string array.
 */
function renderSqlExpression(expr: unknown): string {
  const chunks = (expr as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((chunk) => {
      const c = chunk as { name?: string; value?: string[] };
      if (typeof c.name === "string") return c.name;
      if (Array.isArray(c.value)) return c.value.join("");
      return "";
    })
    .join("");
}

/**
 * Stubs db.update(users) and captures the `set` payload so the test can inspect
 * the expression that would reach the database.
 */
function mockUsersUpdate(newCredits: number) {
  const setMock = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ credits: newCredits }]),
    }),
  });
  vi.mocked(db.update).mockReturnValue({ set: setMock } as never);
  return setMock;
}

function mockUsersUpdateReturningNothing() {
  const setMock = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  });
  vi.mocked(db.update).mockReturnValue({ set: setMock } as never);
  return setMock;
}

function mockCreditsSelect(rows: Array<{ credits: number }>) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("refundCredit", () => {
  it("increments the balance by 1 and returns the new count", async () => {
    const setMock = mockUsersUpdate(3);

    const result = await refundCredit("user-1");

    expect(result).toBe(3);
    expect(db.update).toHaveBeenCalledWith(users);

    const setPayload = setMock.mock.calls[0][0];
    expect(renderSqlExpression(setPayload.credits)).toBe("credits + 1");
  });

  it("computes the new balance DB-side, not by reading then writing", async () => {
    mockUsersUpdate(3);

    await refundCredit("user-1");

    // A read-modify-write would have had to SELECT the current balance first.
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 0 when the user row does not exist", async () => {
    mockUsersUpdateReturningNothing();

    await expect(refundCredit("ghost-user")).resolves.toBe(0);
  });
});

describe("decrementCredits", () => {
  it("decrements the balance by 1 and returns the new count", async () => {
    const setMock = mockUsersUpdate(2);

    const result = await decrementCredits("user-1");

    expect(result).toBe(2);

    const setPayload = setMock.mock.calls[0][0];
    expect(renderSqlExpression(setPayload.credits)).toBe("credits - 1");
  });
});

describe("refundCredit / decrementCredits symmetry", () => {
  it("uses opposing operators on the same column", async () => {
    const decrementSet = mockUsersUpdate(2);
    await decrementCredits("user-1");
    const decrementExpr = renderSqlExpression(decrementSet.mock.calls[0][0].credits);

    const refundSet = mockUsersUpdate(3);
    await refundCredit("user-1");
    const refundExpr = renderSqlExpression(refundSet.mock.calls[0][0].credits);

    expect(decrementExpr).toBe("credits - 1");
    expect(refundExpr).toBe("credits + 1");
    // Same column, so a refund exactly undoes a decrement.
    expect(decrementExpr.replace(" - 1", "")).toBe(refundExpr.replace(" + 1", ""));
  });
});

describe("getUserCredits", () => {
  it("returns the stored balance", async () => {
    mockCreditsSelect([{ credits: 2 }]);
    await expect(getUserCredits("user-1")).resolves.toBe(2);
  });

  it("returns 0 for an unknown user", async () => {
    mockCreditsSelect([]);
    await expect(getUserCredits("ghost-user")).resolves.toBe(0);
  });
});

describe("hasCredits", () => {
  it("is true when the balance is positive", async () => {
    mockCreditsSelect([{ credits: 1 }]);
    await expect(hasCredits("user-1")).resolves.toBe(true);
  });

  it("is false at a zero balance", async () => {
    mockCreditsSelect([{ credits: 0 }]);
    await expect(hasCredits("user-1")).resolves.toBe(false);
  });
});
