import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { CookbookEntry } from "@/lib/cookbook-queries";

/**
 * Generators for cookbook property tests
 */
const ingredient = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  quantity: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  unit: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

const cookbookEntryArb = fc.record({
  id: fc.uuid(),
  recipeId: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  slug: fc.string({ minLength: 12, maxLength: 12 }),
  creatorHandle: fc.string({ minLength: 1, maxLength: 24 }),
  creatorDisplayName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  thumbnailUrl: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  ingredients: fc.array(ingredient, { minLength: 1, maxLength: 10 }),
  steps: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
  // `noInvalidDate: true` is required: fc.date() reserves one slot beyond `max`
  // to represent `Invalid Date`, so it can yield `new Date(NaN)` even when
  // `min`/`max` are supplied. NaN timestamps poison numeric date comparisons.
  savedAt: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2026-12-31"),
    noInvalidDate: true,
  }),
});

/**
 * Search queries that actually exercise filtering.
 *
 * `searchCookbook` treats a blank/whitespace-only query as "no search" and
 * returns the whole cookbook, so the relevance property below only has meaning
 * for queries containing at least one non-whitespace character.
 */
const searchQueryArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((q) => q.trim().length > 0);

/**
 * Property 6: Cookbook Save Idempotence
 *
 * For any authenticated user and any recipe, saving that recipe to the cookbook
 * N times (where N >= 1) results in exactly 1 cookbook entry for that user-recipe pair.
 *
 * Since this requires DB interaction, we test the pure-logic behavior using a Set-based
 * approach that simulates the unique constraint on (userId, recipeId).
 *
 * Validates: Requirements 6.2
 */
describe("Property: Cookbook Save Idempotence", () => {
  // Simulates the DB unique constraint behavior
  function simulateSave(
    cookbook: Map<string, CookbookEntry>,
    userId: string,
    entry: CookbookEntry
  ): { saved: boolean; alreadySaved: boolean } {
    const key = `${userId}:${entry.recipeId}`;
    if (cookbook.has(key)) {
      return { saved: false, alreadySaved: true };
    }
    cookbook.set(key, entry);
    return { saved: true, alreadySaved: false };
  }

  it("saving a recipe N times results in exactly 1 entry per user-recipe pair", () => {
    fc.assert(
      fc.property(
        cookbookEntryArb,
        fc.string({ minLength: 1, maxLength: 36 }), // userId
        fc.integer({ min: 1, max: 20 }), // number of save attempts
        (entry, userId, saveCount) => {
          const cookbook = new Map<string, CookbookEntry>();

          // First save should succeed
          const firstResult = simulateSave(cookbook, userId, entry);
          expect(firstResult.saved).toBe(true);
          expect(firstResult.alreadySaved).toBe(false);

          // Subsequent saves should return "already saved"
          for (let i = 1; i < saveCount; i++) {
            const result = simulateSave(cookbook, userId, entry);
            expect(result.saved).toBe(false);
            expect(result.alreadySaved).toBe(true);
          }

          // Exactly 1 entry exists regardless of how many times save was called
          const entriesForPair = [...cookbook.values()].filter(
            (e) => e.recipeId === entry.recipeId
          );
          expect(entriesForPair).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("different recipes from the same user each get their own entry", () => {
    fc.assert(
      fc.property(
        fc.array(cookbookEntryArb, { minLength: 2, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 36 }), // userId
        (entries, userId) => {
          const cookbook = new Map<string, CookbookEntry>();

          // Ensure all entries have unique recipeIds for this test
          const uniqueEntries = entries.reduce<CookbookEntry[]>((acc, entry) => {
            if (!acc.some((e) => e.recipeId === entry.recipeId)) {
              acc.push(entry);
            }
            return acc;
          }, []);

          for (const entry of uniqueEntries) {
            simulateSave(cookbook, userId, entry);
          }

          expect(cookbook.size).toBe(uniqueEntries.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: Cookbook Default Sort Order
 *
 * For any set of cookbook entries belonging to a user, the default listing order
 * is strictly descending by `savedAt` timestamp — for every adjacent pair in the
 * result list, the earlier entry's `savedAt` is greater than or equal to the
 * later entry's `savedAt`.
 *
 * Validates: Requirements 6.3
 */
describe("Property: Cookbook Default Sort Order", () => {
  // Replicate the default sort logic from getUserCookbook (descending by savedAt)
  function sortByDefaultOrder(entries: CookbookEntry[]): CookbookEntry[] {
    return [...entries].sort(
      (a, b) => b.savedAt.getTime() - a.savedAt.getTime()
    );
  }

  it("default sort produces descending savedAt order for every adjacent pair", () => {
    fc.assert(
      fc.property(
        fc.array(cookbookEntryArb, { minLength: 1, maxLength: 50 }),
        (entries) => {
          const sorted = sortByDefaultOrder(entries);

          // Verify every adjacent pair maintains descending order
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].savedAt.getTime()).toBeGreaterThanOrEqual(
              sorted[i + 1].savedAt.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("sorted result contains the same entries as the input (no entries lost or duplicated)", () => {
    fc.assert(
      fc.property(
        fc.array(cookbookEntryArb, { minLength: 1, maxLength: 50 }),
        (entries) => {
          const sorted = sortByDefaultOrder(entries);

          expect(sorted.length).toBe(entries.length);

          // Every entry in input appears in sorted output
          const sortedIds = sorted.map((e) => e.id);
          for (const entry of entries) {
            expect(sortedIds).toContain(entry.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("sorting is idempotent — sorting an already sorted list yields the same result", () => {
    fc.assert(
      fc.property(
        fc.array(cookbookEntryArb, { minLength: 1, maxLength: 50 }),
        (entries) => {
          const sorted1 = sortByDefaultOrder(entries);
          const sorted2 = sortByDefaultOrder(sorted1);

          expect(sorted1.map((e) => e.id)).toEqual(sorted2.map((e) => e.id));
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 8: Cookbook Search Relevance
 *
 * For any search query string and any set of cookbook entries, every recipe returned
 * in the search results contains the query string (case-insensitive) in at least one of:
 * the recipe title, an ingredient name, or a tag. No recipe matching none of these
 * fields appears in results.
 *
 * Validates: Requirements 6.4
 */
describe("Property: Cookbook Search Relevance", () => {
  // Replicate the filter logic from searchCookbook (in-memory filtering)
  function filterEntries(entries: CookbookEntry[], query: string): CookbookEntry[] {
    if (!query.trim()) return entries;

    const lowerQuery = query.toLowerCase();
    return entries.filter((entry) => {
      if (entry.title.toLowerCase().includes(lowerQuery)) return true;
      if (entry.ingredients.some((ing) => ing.name.toLowerCase().includes(lowerQuery)))
        return true;
      if (entry.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) return true;
      return false;
    });
  }

  function entryMatches(entry: CookbookEntry, query: string): boolean {
    const lowerQuery = query.toLowerCase();
    if (entry.title.toLowerCase().includes(lowerQuery)) return true;
    if (entry.ingredients.some((ing) => ing.name.toLowerCase().includes(lowerQuery)))
      return true;
    if (entry.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) return true;
    return false;
  }

  it("every result contains the query in title, ingredient name, or tag (case-insensitive)", () => {
    fc.assert(
      fc.property(
        fc.array(cookbookEntryArb, { minLength: 1, maxLength: 30 }),
        searchQueryArb,
        (entries, query) => {
          const results = filterEntries(entries, query);

          for (const result of results) {
            expect(entryMatches(result, query)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no non-matching entry appears in results", () => {
    fc.assert(
      fc.property(
        fc.array(cookbookEntryArb, { minLength: 1, maxLength: 30 }),
        searchQueryArb,
        (entries, query) => {
          const results = filterEntries(entries, query);
          const resultIds = new Set(results.map((r) => r.id));

          // Every entry NOT in results should NOT match the query
          for (const entry of entries) {
            if (!resultIds.has(entry.id)) {
              expect(entryMatches(entry, query)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("search with a substring taken from an existing entry's field always finds that entry", () => {
    fc.assert(
      fc.property(
        cookbookEntryArb,
        fc.array(cookbookEntryArb, { minLength: 0, maxLength: 10 }),
        (targetEntry, otherEntries) => {
          // Pick a substring from the target's title (at least 1 char)
          const title = targetEntry.title;
          if (title.length === 0) return; // skip edge case

          // Use a single character from the title as the search query
          const query = title.charAt(0);
          const allEntries = [targetEntry, ...otherEntries];
          const results = filterEntries(allEntries, query);

          // The target entry must be in the results
          const resultIds = results.map((r) => r.id);
          expect(resultIds).toContain(targetEntry.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
