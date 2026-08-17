/**
 * Integration tests for the account deletion server action (deleteAccount).
 *
 * Mocks the DB layer, auth, and next/headers to test the action in isolation.
 * The point of these tests is the blast radius: an account delete must be
 * scoped to exactly one user id, and must not run at all without a session.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockDelete, mockTransaction, mockGetSession } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    delete: mockDelete,
    transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { deleteAccount } from "@/actions/account";
import { users } from "@/db/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wires up the transaction so the tx handle shares the same `delete` mock as the
 * db handle. That lets a test assert on "the delete that happened" without
 * caring whether the action reached for `db` or `tx`.
 */
function mockDeleteSucceeds() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  mockDelete.mockReturnValue({ where: whereMock });
  mockTransaction.mockImplementation(
    async (callback: (tx: { delete: typeof mockDelete }) => Promise<void>) =>
      callback({ delete: mockDelete })
  );
  return { whereMock };
}

/** Walks a drizzle SQL tree collecting column names and bound parameter values. */
function collectClause(
  node: unknown,
  out: { columns: string[]; values: unknown[] } = { columns: [], values: [] }
): { columns: string[]; values: unknown[] } {
  const n = node as {
    name?: string;
    value?: unknown;
    queryChunks?: unknown[];
    left?: unknown;
    right?: unknown;
  };
  if (n && typeof n === "object") {
    if (typeof n.name === "string") out.columns.push(n.name);
    if ("value" in n) out.values.push(n.value);
    for (const key of ["queryChunks", "left", "right"] as const) {
      const child = n[key];
      if (Array.isArray(child)) {
        for (const chunk of child) collectClause(chunk, out);
      } else if (child) {
        collectClause(child, out);
      }
    }
  }
  return out;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("deleteAccount - account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns UNAUTHORIZED when there is no session", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await deleteAccount();

      expect(result).toEqual({
        error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      });
    });

    it("touches nothing in the database without a session", async () => {
      mockGetSession.mockResolvedValue(null);
      mockDeleteSucceeds();

      await deleteAccount();

      // No session means no user id to scope by, so nothing may run.
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe("with a session", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
        session: { id: "session-1" },
      });
    });

    it("deletes the user row and returns success", async () => {
      const { whereMock } = mockDeleteSucceeds();

      const result = await deleteAccount();

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalledWith(users);
      expect(whereMock).toHaveBeenCalled();
    });

    it("scopes the delete to the session's user id", async () => {
      const { whereMock } = mockDeleteSucceeds();

      await deleteAccount();

      // An unfiltered delete would arrive here with no WHERE clause at all.
      expect(whereMock).toHaveBeenCalledTimes(1);
      const clause = whereMock.mock.calls[0][0];
      expect(clause).toBeDefined();

      const { columns, values } = collectClause(clause);
      expect(columns).toContain("id");
      expect(values).toContain("user-1");
    });

    it("never issues a delete against another user's id", async () => {
      const { whereMock } = mockDeleteSucceeds();

      await deleteAccount();

      const { values } = collectClause(whereMock.mock.calls[0][0]);
      const idValues = values.filter((v) => typeof v === "string");
      expect(idValues).toEqual(["user-1"]);
    });

    it("runs the deletion inside a transaction", async () => {
      mockDeleteSucceeds();

      await deleteAccount();

      // All-or-nothing: a cascade that fails halfway must roll back rather than
      // leave a half-deleted account.
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it("returns DELETE_FAILED instead of throwing when the database rejects it", async () => {
      mockTransaction.mockRejectedValue(new Error("connection lost"));

      const result = await deleteAccount();

      expect(result).toEqual({
        error: expect.objectContaining({ code: "DELETE_FAILED" }),
      });
    });
  });
});
