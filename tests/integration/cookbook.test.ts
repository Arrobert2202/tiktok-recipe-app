import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to define mock functions that will be available inside vi.mock factories
const { mockRevalidatePath, mockInsert, mockDelete, mockUpdate, mockSelect, mockGetSession } =
  vi.hoisted(() => ({
    mockRevalidatePath: vi.fn(),
    mockInsert: vi.fn(),
    mockDelete: vi.fn(),
    mockUpdate: vi.fn(),
    mockSelect: vi.fn(),
    mockGetSession: vi.fn(),
  }));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

// Mock @/db
vi.mock("@/db", () => ({
  db: {
    insert: mockInsert,
    delete: mockDelete,
    update: mockUpdate,
    select: mockSelect,
  },
}));

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

// Import actions after mocks are set up
import {
  saveRecipeToCookbook,
  removeRecipeFromCookbook,
  updateRecipeTags,
} from "@/actions/cookbook";

describe("Cookbook Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveRecipeToCookbook", () => {
    it("returns UNAUTHORIZED error when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await saveRecipeToCookbook("recipe-123");

      expect(result).toEqual({
        error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      });
    });

    it("inserts entry and returns success on first save", async () => {
      mockGetSession.mockResolvedValue({
        user: { id: "user-1" },
      });

      // Chain: insert().values().onConflictDoNothing().returning()
      const mockReturning = vi.fn().mockResolvedValue([{ id: "entry-1" }]);
      const mockOnConflictDoNothing = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
      mockInsert.mockReturnValue({ values: mockValues });

      const result = await saveRecipeToCookbook("recipe-123");

      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        userId: "user-1",
        recipeId: "recipe-123",
      });
    });

    it("returns ALREADY_SAVED error on duplicate save", async () => {
      mockGetSession.mockResolvedValue({
        user: { id: "user-1" },
      });

      // onConflictDoNothing returns empty array for duplicates
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockOnConflictDoNothing = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
      mockInsert.mockReturnValue({ values: mockValues });

      const result = await saveRecipeToCookbook("recipe-123");

      expect(result).toEqual({
        error: expect.objectContaining({ code: "ALREADY_SAVED" }),
      });
    });
  });

  describe("removeRecipeFromCookbook", () => {
    it("returns UNAUTHORIZED error when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await removeRecipeFromCookbook("recipe-123");

      expect(result).toEqual({
        error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      });
    });

    it("deletes entry, calls revalidatePath, and returns success", async () => {
      mockGetSession.mockResolvedValue({
        user: { id: "user-1" },
      });

      // Chain: delete().where()
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      mockDelete.mockReturnValue({ where: mockWhere });

      const result = await removeRecipeFromCookbook("recipe-123");

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/cookbook");
    });
  });

  describe("updateRecipeTags", () => {
    it("returns UNAUTHORIZED error when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await updateRecipeTags("recipe-123", ["dinner"]);

      expect(result).toEqual({
        error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      });
    });

    it("returns VALIDATION_ERROR when a tag exceeds 50 characters", async () => {
      mockGetSession.mockResolvedValue({
        user: { id: "user-1" },
      });

      const longTag = "a".repeat(51);
      const result = await updateRecipeTags("recipe-123", [longTag]);

      expect(result).toEqual({
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });

    it("returns VALIDATION_ERROR when more than 20 tags provided", async () => {
      mockGetSession.mockResolvedValue({
        user: { id: "user-1" },
      });

      const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      const result = await updateRecipeTags("recipe-123", tooManyTags);

      expect(result).toEqual({
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });

    it("updates entry, calls revalidatePath, and returns success for valid tags", async () => {
      mockGetSession.mockResolvedValue({
        user: { id: "user-1" },
      });

      // Chain: update().set().where()
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockUpdate.mockReturnValue({ set: mockSet });

      const result = await updateRecipeTags("recipe-123", ["dinner", "quick"]);

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ tags: ["dinner", "quick"] });
      expect(mockWhere).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/cookbook");
    });
  });
});
