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

import { refundCredit, claimCredit, getUserCredits, hasCredits } from "./credits";
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
 * Walks a drizzle SQL tree and collects every column name it references, so
 * a test can assert a WHERE clause guards on a given column without depending
 * on drizzle's internal AST shape.
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

/**
 * Stubs db.update(users) and captures the `set` payload plus the `where`
 * clause so a test can inspect both the expression and the guard that would
 * reach the database.
 */
function mockUsersUpdate(newCredits: number) {
  const whereMock = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ credits: newCredits }]),
  });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  vi.mocked(db.update).mockReturnValue({ set: setMock } as never);
  return { setMock, whereMock };
}

function mockUsersUpdateReturningNothing() {
  const whereMock = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([]),
  });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  vi.mocked(db.update).mockReturnValue({ set: setMock } as never);
  return { setMock, whereMock };
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
    const { setMock } = mockUsersUpdate(3);

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

describe("claimCredit", () => {
  it("decrements the balance by 1 and returns the new count", async () => {
    const { setMock } = mockUsersUpdate(2);

    const result = await claimCredit("user-1");

    expect(result).toBe(2);

    const setPayload = setMock.mock.calls[0][0];
    expect(renderSqlExpression(setPayload.credits)).toBe("credits - 1");
  });

  it("computes the new balance DB-side, not by reading then writing", async () => {
    mockUsersUpdate(2);

    await claimCredit("user-1");

    // A read-modify-write (the old hasCredits + decrementCredits pair) would
    // have had to SELECT the balance first, leaving a window for a concurrent
    // request to read the same stale value.
    expect(db.select).not.toHaveBeenCalled();
  });

  it("issues a single UPDATE guarded by both id and credits > 0", async () => {
    const { whereMock } = mockUsersUpdate(2);

    await claimCredit("user-1");

    expect(db.update).toHaveBeenCalledTimes(1);
    const whereClause = whereMock.mock.calls[0][0];
    const columns = collectColumnNames(whereClause);
    expect(columns).toContain("id");
    expect(columns).toContain("credits");
  });

  it("returns null, without writing, when the user has zero credits", async () => {
    const { setMock } = mockUsersUpdateReturningNothing();

    const result = await claimCredit("user-1");

    // The WHERE clause matched nothing (credits > 0 was false), so RETURNING
    // came back empty — this is what a real database does when a concurrent
    // claim already drained the balance to zero.
    expect(result).toBeNull();
    // The claim was still attempted as one statement, not skipped by a
    // pre-check — there's nothing to distinguish "no rows matched" from
    // "we never asked" other than the empty RETURNING result.
    expect(setMock).toHaveBeenCalledTimes(1);
  });
});

describe("refundCredit / claimCredit symmetry", () => {
  it("uses opposing operators on the same column", async () => {
    const { setMock: decrementSet } = mockUsersUpdate(2);
    await claimCredit("user-1");
    const decrementExpr = renderSqlExpression(decrementSet.mock.calls[0][0].credits);

    const { setMock: refundSet } = mockUsersUpdate(3);
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
