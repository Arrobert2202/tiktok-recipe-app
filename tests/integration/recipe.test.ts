/**
 * Integration tests for updateRecipe's ownership check.
 *
 * `recipes` has no per-user copies — it's the single shared row `/r/[slug]`
 * and every saver's cookbook read from. Before ownerId existed, `updateRecipe`
 * authorized anyone who had saved the recipe, so any saver could rewrite
 * content everyone else (and the public share page) saw too. These tests pin
 * that only the owner can edit, and that the check is a single atomic
 * UPDATE — not a separate ownership SELECT a caller could race.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRevalidatePath, mockSelect, mockUpdate, mockGetSession } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

import { updateRecipe } from "@/actions/recipe";

const VALID_EDIT = {
  title: "Seared Steak",
  ingredients: [{ name: "steak", quantity: "1", unit: "" }],
  steps: ["Sear it", "Rest it"],
};

function mockAuthenticated(userId: string) {
  mockGetSession.mockResolvedValue({
    user: { id: userId, name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  } as never);
}

/**
 * Stubs db.update(recipes).set(...).where(...).returning(...) and captures
 * the where clause so a test can inspect what column values it guarded on.
 */
function mockUpdateResult(rows: Array<Record<string, unknown>>) {
  const whereMock = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  mockUpdate.mockReturnValue({ set: setMock });
  return { setMock, whereMock };
}

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateRecipe", () => {
  it("returns UNAUTHORIZED when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await updateRecipe("recipe-1", VALID_EDIT);

    expect(result).toEqual({
      error: { code: "UNAUTHORIZED", message: "You must be signed in to edit recipes" },
    });
  });

  it("returns VALIDATION_ERROR for invalid input without touching the database", async () => {
    mockAuthenticated("user-1");

    const result = await updateRecipe("recipe-1", { ...VALID_EDIT, title: "" });

    expect(result).toHaveProperty("error");
    const { error } = result as { error: { code: string } };
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates the recipe when the caller is the owner", async () => {
    mockAuthenticated("owner-1");
    mockUpdateResult([
      {
        id: "recipe-1",
        title: "Seared Steak",
        ingredients: VALID_EDIT.ingredients,
        steps: VALID_EDIT.steps,
        slug: "abc123",
      },
    ]);

    const result = await updateRecipe("recipe-1", VALID_EDIT);

    expect(result).toEqual({
      success: true,
      recipe: {
        id: "recipe-1",
        title: "Seared Steak",
        ingredients: VALID_EDIT.ingredients,
        steps: VALID_EDIT.steps,
      },
    });
  });

  it("rejects a non-owner even if they saved the recipe, without a separate ownership SELECT", async () => {
    mockAuthenticated("saver-not-owner");
    mockUpdateResult([]); // WHERE (id AND owner_id = caller) matched nothing

    const result = await updateRecipe("recipe-1", VALID_EDIT);

    expect(result).toEqual({ error: { code: "NOT_FOUND", message: "Recipe not found" } });
    // The guard lives in the UPDATE's WHERE clause, not a prior read — a
    // SELECT-then-UPDATE would leave a window where ownership could change
    // between the two statements.
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("rejects everyone when the recipe has no owner (ownerId is NULL)", async () => {
    // Anonymous-path recipes, or ones from before this column existed and
    // couldn't be backfilled, have owner_id = NULL. `eq(recipes.ownerId,
    // session.user.id)` never matches NULL for any caller, so this behaves
    // identically to the non-owner case above — nobody can edit it.
    mockAuthenticated("any-user");
    mockUpdateResult([]);

    const result = await updateRecipe("recipe-1", VALID_EDIT);

    expect(result).toEqual({ error: { code: "NOT_FOUND", message: "Recipe not found" } });
  });

  it("guards the UPDATE's WHERE clause on both id and ownerId", async () => {
    mockAuthenticated("owner-1");
    const { whereMock } = mockUpdateResult([
      { id: "recipe-1", title: "x", ingredients: [], steps: [], slug: "abc" },
    ]);

    await updateRecipe("recipe-1", VALID_EDIT);

    const columns = collectColumnNames(whereMock.mock.calls[0][0]);
    expect(columns).toContain("id");
    expect(columns).toContain("owner_id");
  });
});
