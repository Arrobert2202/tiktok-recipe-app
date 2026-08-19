/**
 * Integration tests for the creator opt-out flow.
 *
 * actions/creator.ts used to be a stub — submitOptOutRequest/reverseOptOut
 * validated input and returned {success: true} without ever touching the
 * database. These tests pin the real behavior: a request only takes effect
 * once its email confirmation link is clicked (confirmCreatorAction), an
 * already-active handle can't be hijacked by resubmitting with a different
 * email, and reversal only honors the email that originally opted the
 * handle out — with the exact same response whether that check passes or
 * fails, so the endpoint can't be used to probe a handle's status.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7" })),
}));

vi.mock("@/lib/ip-limit", () => ({
  tryConsumeIpAction: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/email", () => ({
  sendCreatorVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/opt-out-cache", () => ({
  invalidateOptOutCache: vi.fn(),
}));

vi.mock("@/lib/verification-token", () => ({
  generateVerificationToken: vi.fn().mockReturnValue("generated-token"),
}));

import {
  submitOptOutRequest,
  reverseOptOut,
  confirmCreatorAction,
} from "@/actions/creator";
import { db } from "@/db";
import { recipes, recipeCache, creatorOptOuts } from "@/db/schema";
import { tryConsumeIpAction } from "@/lib/ip-limit";
import { sendCreatorVerificationEmail } from "@/lib/email";
import { invalidateOptOutCache } from "@/lib/opt-out-cache";

function mockSelectResult(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never);
}

function mockUpdate() {
  const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  vi.mocked(db.update).mockReturnValue({ set: setMock } as never);
  return setMock;
}

function mockInsert() {
  const valuesMock = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never);
  return valuesMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tryConsumeIpAction).mockResolvedValue(true);
});

describe("submitOptOutRequest", () => {
  it("rejects an invalid handle without touching the database", async () => {
    const result = await submitOptOutRequest("bad handle!", "creator@example.com");

    expect(result.success).toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    mockSelectResult([]);
    const result = await submitOptOutRequest("chef", "not-an-email");

    expect(result.success).toBe(false);
  });

  it("is rate limited by IP", async () => {
    vi.mocked(tryConsumeIpAction).mockResolvedValue(false);

    const result = await submitOptOutRequest("chef", "creator@example.com");

    expect(result).toEqual({ success: false, error: "Too many requests. Please try again later." });
    expect(sendCreatorVerificationEmail).not.toHaveBeenCalled();
  });

  it("inserts a new pending row and sends the verification email for a never-requested handle", async () => {
    mockSelectResult([]);
    const insertValues = mockInsert();

    const result = await submitOptOutRequest("Chef", "creator@example.com");

    expect(result).toEqual({ success: true });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: "chef", // normalized to lowercase
        email: "creator@example.com",
        pendingToken: "generated-token",
        pendingAction: "opt_out",
      })
    );
    expect(sendCreatorVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "creator@example.com", handle: "chef", action: "opt_out" })
    );
  });

  it("updates the pending request when one already exists but isn't active", async () => {
    mockSelectResult([
      { id: "row-1", handle: "chef", email: "old@example.com", verifiedAt: null, reversedAt: null },
    ]);
    const updateSet = mockUpdate();

    const result = await submitOptOutRequest("chef", "new@example.com");

    expect(result).toEqual({ success: true });
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com", pendingAction: "opt_out" })
    );
    expect(sendCreatorVerificationEmail).toHaveBeenCalled();
  });

  it("no-ops on an already-active handle without changing email or sending mail", async () => {
    // The hijack case this closes: without this no-op, resubmitting an
    // already-active handle with a different email would silently make
    // that email the one reverseOptOut later trusts.
    mockSelectResult([
      {
        id: "row-1",
        handle: "chef",
        email: "real-creator@example.com",
        verifiedAt: new Date("2026-01-01"),
        reversedAt: null,
      },
    ]);

    const result = await submitOptOutRequest("chef", "attacker@example.com");

    expect(result).toEqual({ success: true });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(sendCreatorVerificationEmail).not.toHaveBeenCalled();
  });

  it("allows re-opting-out a handle that was previously reversed", async () => {
    mockSelectResult([
      {
        id: "row-1",
        handle: "chef",
        email: "creator@example.com",
        verifiedAt: new Date("2026-01-01"),
        reversedAt: new Date("2026-02-01"),
      },
    ]);
    const updateSet = mockUpdate();

    const result = await submitOptOutRequest("chef", "creator@example.com");

    expect(result).toEqual({ success: true });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ pendingAction: "opt_out" }));
    expect(sendCreatorVerificationEmail).toHaveBeenCalled();
  });
});

describe("reverseOptOut", () => {
  it("rejects an invalid handle without touching the database", async () => {
    const result = await reverseOptOut("bad handle!", "creator@example.com");

    expect(result.success).toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("is rate limited by IP", async () => {
    vi.mocked(tryConsumeIpAction).mockResolvedValue(false);

    const result = await reverseOptOut("chef", "creator@example.com");

    expect(result.success).toBe(false);
  });

  it("returns generic success without sending mail when the handle has no row", async () => {
    mockSelectResult([]);

    const result = await reverseOptOut("chef", "creator@example.com");

    expect(result).toEqual({ success: true });
    expect(sendCreatorVerificationEmail).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns generic success without sending mail when the handle isn't currently active", async () => {
    mockSelectResult([
      { id: "row-1", handle: "chef", email: "creator@example.com", verifiedAt: null, reversedAt: null },
    ]);

    const result = await reverseOptOut("chef", "creator@example.com");

    expect(result).toEqual({ success: true });
    expect(sendCreatorVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns the identical generic success, without sending mail, when the email doesn't match", async () => {
    mockSelectResult([
      {
        id: "row-1",
        handle: "chef",
        email: "real-creator@example.com",
        verifiedAt: new Date("2026-01-01"),
        reversedAt: null,
      },
    ]);

    const result = await reverseOptOut("chef", "someone-else@example.com");

    expect(result).toEqual({ success: true });
    expect(sendCreatorVerificationEmail).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("sends a reversal confirmation when the row is active and the email matches (case-insensitive)", async () => {
    mockSelectResult([
      {
        id: "row-1",
        handle: "chef",
        email: "Creator@Example.com",
        verifiedAt: new Date("2026-01-01"),
        reversedAt: null,
      },
    ]);
    const updateSet = mockUpdate();

    const result = await reverseOptOut("chef", "creator@example.com");

    expect(result).toEqual({ success: true });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ pendingAction: "reverse" }));
    expect(sendCreatorVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "Creator@Example.com", action: "reverse" })
    );
  });
});

describe("confirmCreatorAction", () => {
  /**
   * Mocks db.transaction to actually invoke the callback with a fake tx
   * whose .select().from().where().for("update") resolves to `lockedRow`
   * (empty array for "no matching token"), and whose subsequent plain
   * .select({id}).from(recipes).where() call (the cascade's "which recipes
   * match this handle" lookup) resolves to `matchingRecipeIds`.
   */
  function mockTransaction(lockedRow: Record<string, unknown> | undefined, matchingRecipeIds: string[] = []) {
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
    const deleteCalls: unknown[] = [];

    const tx = {
      select: vi.fn().mockImplementation((projection?: unknown) => {
        // The locking select passes no projection (selects the whole row);
        // the cascade's lookup passes {id: recipes.id}.
        const isCascadeLookup = !!projection;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              if (isCascadeLookup) {
                return Promise.resolve(matchingRecipeIds.map((id) => ({ id })));
              }
              return {
                for: vi.fn().mockResolvedValue(lockedRow ? [lockedRow] : []),
              };
            }),
          }),
        };
      }),
      update: vi.fn().mockImplementation((table: unknown) => ({
        set: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          updateCalls.push({ table, payload });
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      })),
      delete: vi.fn().mockImplementation((table: unknown) => {
        deleteCalls.push(table);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    };

    vi.mocked(db.transaction).mockImplementation(
      (async (callback: (tx: unknown) => unknown) => callback(tx)) as typeof db.transaction
    );

    return { tx, updateCalls, deleteCalls };
  }

  it("returns an error without applying anything when the token is invalid or expired", async () => {
    mockTransaction(undefined);

    const result = await confirmCreatorAction("bad-token");

    expect(result).toEqual({ success: false, error: "This link is invalid or has expired." });
    expect(invalidateOptOutCache).not.toHaveBeenCalled();
  });

  it("applies the opt-out cascade and invalidates the cache on a valid opt_out token", async () => {
    const { updateCalls, deleteCalls } = mockTransaction(
      { id: "row-1", handle: "chef", pendingAction: "opt_out" },
      ["recipe-1", "recipe-2"]
    );

    const result = await confirmCreatorAction("valid-token");

    expect(result).toEqual({ success: true, action: "opt_out", handle: "chef" });

    const optOutUpdate = updateCalls.find((c) => c.table === creatorOptOuts);
    expect(optOutUpdate?.payload).toMatchObject({
      pendingToken: null,
      pendingAction: null,
      reversedAt: null,
    });
    expect(optOutUpdate?.payload.verifiedAt).toBeInstanceOf(Date);

    const recipesUpdate = updateCalls.find((c) => c.table === recipes);
    expect(recipesUpdate?.payload).toEqual({ isPublic: false });

    expect(deleteCalls).toContain(recipeCache);
    expect(invalidateOptOutCache).toHaveBeenCalledTimes(1);
  });

  it("skips the recipe_cache delete when no recipes match the handle", async () => {
    const { deleteCalls } = mockTransaction(
      { id: "row-1", handle: "chef", pendingAction: "opt_out" },
      []
    );

    await confirmCreatorAction("valid-token");

    expect(deleteCalls).not.toContain(recipeCache);
  });

  it("applies the reversal and restores isPublic on a valid reverse token", async () => {
    const { updateCalls } = mockTransaction({ id: "row-1", handle: "chef", pendingAction: "reverse" });

    const result = await confirmCreatorAction("valid-token");

    expect(result).toEqual({ success: true, action: "reverse", handle: "chef" });

    const optOutUpdate = updateCalls.find((c) => c.table === creatorOptOuts);
    expect(optOutUpdate?.payload).toMatchObject({ pendingToken: null, pendingAction: null });
    expect(optOutUpdate?.payload.reversedAt).toBeInstanceOf(Date);

    const recipesUpdate = updateCalls.find((c) => c.table === recipes);
    expect(recipesUpdate?.payload).toEqual({ isPublic: true });

    expect(invalidateOptOutCache).toHaveBeenCalledTimes(1);
  });
});
