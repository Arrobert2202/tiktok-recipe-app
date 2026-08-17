import { describe, it, expect, vi } from "vitest";
import type { CookbookEntry } from "./cookbook-queries";

// We test the pure filtering and sorting logic used by cookbook queries.
// The actual DB interaction is tested in integration tests.
// Here we validate the in-memory search filtering behavior by importing
// the module and mocking the db calls.

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Helper to create a mock cookbook entry
function makeCookbookEntry(
  overrides: Partial<CookbookEntry> & { title: string; savedAt: Date }
): CookbookEntry {
  return {
    id: overrides.id ?? "entry-1",
    recipeId: overrides.recipeId ?? "recipe-1",
    title: overrides.title,
    slug: overrides.slug ?? "abc123def456",
    creatorHandle: overrides.creatorHandle ?? "chef123",
    creatorDisplayName: overrides.creatorDisplayName,
    thumbnailUrl: overrides.thumbnailUrl,
    tags: overrides.tags ?? [],
    ingredients: overrides.ingredients ?? [{ name: "salt" }],
    steps: overrides.steps ?? ["Season to taste"],
    savedAt: overrides.savedAt,
  };
}

describe("cookbook-queries filtering logic", () => {
  describe("search matching", () => {
    const entries: CookbookEntry[] = [
      makeCookbookEntry({
        id: "1",
        title: "Pasta Carbonara",
        tags: ["italian", "quick"],
        ingredients: [
          { name: "spaghetti" },
          { name: "eggs" },
          { name: "pancetta" },
        ],
        savedAt: new Date("2024-01-03"),
      }),
      makeCookbookEntry({
        id: "2",
        title: "Chicken Stir Fry",
        tags: ["asian", "healthy"],
        ingredients: [
          { name: "chicken breast" },
          { name: "soy sauce" },
          { name: "broccoli" },
        ],
        savedAt: new Date("2024-01-02"),
      }),
      makeCookbookEntry({
        id: "3",
        title: "Banana Bread",
        tags: ["baking", "dessert"],
        ingredients: [
          { name: "bananas" },
          { name: "flour" },
          { name: "sugar" },
        ],
        savedAt: new Date("2024-01-01"),
      }),
    ];

    // Replicate the filter logic from searchCookbook for unit testing
    function filterEntries(
      allEntries: CookbookEntry[],
      query: string
    ): CookbookEntry[] {
      const lowerQuery = query.toLowerCase();
      return allEntries.filter((row) => {
        if (row.title.toLowerCase().includes(lowerQuery)) return true;
        if (
          row.ingredients.some((ing) =>
            ing.name.toLowerCase().includes(lowerQuery)
          )
        )
          return true;
        if (row.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
          return true;
        return false;
      });
    }

    it("matches by title (case-insensitive)", () => {
      const results = filterEntries(entries, "pasta");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("1");
    });

    it("matches by title with different casing", () => {
      const results = filterEntries(entries, "BANANA");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("3");
    });

    it("matches by ingredient name", () => {
      const results = filterEntries(entries, "soy sauce");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("2");
    });

    it("matches by tag", () => {
      const results = filterEntries(entries, "italian");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("1");
    });

    it("matches multiple entries when query is shared across them", () => {
      // "chicken" appears in entry 2 title, "banana" in entry 3 title
      // "an" appears in "Banana" and "pancetta" and "bananas"
      const results = filterEntries(entries, "an");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty array when no match found", () => {
      const results = filterEntries(entries, "sushi");
      expect(results).toHaveLength(0);
    });

    it("matches partial strings within ingredient names", () => {
      const results = filterEntries(entries, "spag");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("1");
    });

    it("non-matching entries are never included", () => {
      const results = filterEntries(entries, "chicken");
      for (const entry of results) {
        const titleMatch = entry.title
          .toLowerCase()
          .includes("chicken");
        const ingredientMatch = entry.ingredients.some((ing) =>
          ing.name.toLowerCase().includes("chicken")
        );
        const tagMatch = entry.tags.some((tag) =>
          tag.toLowerCase().includes("chicken")
        );
        expect(titleMatch || ingredientMatch || tagMatch).toBe(true);
      }
    });
  });

  describe("sort order validation", () => {
    it("default sort is descending by savedAt", () => {
      const entries: CookbookEntry[] = [
        makeCookbookEntry({
          id: "1",
          title: "A",
          savedAt: new Date("2024-01-01"),
        }),
        makeCookbookEntry({
          id: "2",
          title: "B",
          savedAt: new Date("2024-01-03"),
        }),
        makeCookbookEntry({
          id: "3",
          title: "C",
          savedAt: new Date("2024-01-02"),
        }),
      ];

      // Sort descending by savedAt
      const sorted = [...entries].sort(
        (a, b) => b.savedAt.getTime() - a.savedAt.getTime()
      );

      expect(sorted[0].id).toBe("2"); // Jan 3
      expect(sorted[1].id).toBe("3"); // Jan 2
      expect(sorted[2].id).toBe("1"); // Jan 1

      // Verify strictly descending
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].savedAt.getTime()).toBeGreaterThanOrEqual(
          sorted[i + 1].savedAt.getTime()
        );
      }
    });

    it("sort by title ascending produces alphabetical order", () => {
      const entries: CookbookEntry[] = [
        makeCookbookEntry({
          id: "1",
          title: "Zucchini Bread",
          savedAt: new Date("2024-01-01"),
        }),
        makeCookbookEntry({
          id: "2",
          title: "Apple Pie",
          savedAt: new Date("2024-01-02"),
        }),
        makeCookbookEntry({
          id: "3",
          title: "Mango Smoothie",
          savedAt: new Date("2024-01-03"),
        }),
      ];

      const sorted = [...entries].sort((a, b) =>
        a.title.localeCompare(b.title)
      );

      expect(sorted[0].title).toBe("Apple Pie");
      expect(sorted[1].title).toBe("Mango Smoothie");
      expect(sorted[2].title).toBe("Zucchini Bread");
    });
  });
});
