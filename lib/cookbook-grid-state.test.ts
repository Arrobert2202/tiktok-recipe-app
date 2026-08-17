import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applyOptimisticAction } from "./cookbook-grid-state";
import type { CookbookEntry } from "./cookbook-queries";

function makeEntry(overrides: Partial<CookbookEntry> = {}): CookbookEntry {
  return {
    id: "entry-1",
    recipeId: "recipe-1",
    title: "Pasta Carbonara",
    slug: "abc123def456",
    creatorHandle: "chef123",
    creatorDisplayName: "Chef 123",
    thumbnailUrl: "https://example.com/thumb.jpg",
    tags: ["italian"],
    ingredients: [{ name: "spaghetti", quantity: "200", unit: "g" }],
    steps: ["Boil pasta"],
    savedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("applyOptimisticAction", () => {
  describe("remove", () => {
    it("drops only the entry matching recipeId", () => {
      const state = [
        makeEntry({ id: "a", recipeId: "recipe-a" }),
        makeEntry({ id: "b", recipeId: "recipe-b" }),
      ];

      const next = applyOptimisticAction(state, {
        type: "remove",
        recipeId: "recipe-a",
      });

      expect(next.map((e) => e.recipeId)).toEqual(["recipe-b"]);
    });

    it("leaves the list untouched when no entry matches", () => {
      const state = [makeEntry({ recipeId: "recipe-a" })];

      const next = applyOptimisticAction(state, {
        type: "remove",
        recipeId: "recipe-missing",
      });

      expect(next).toEqual(state);
    });
  });

  describe("update", () => {
    it("applies the new title to the matching entry", () => {
      const state = [makeEntry({ recipeId: "recipe-a", title: "Old Title" })];

      const next = applyOptimisticAction(state, {
        type: "update",
        recipeId: "recipe-a",
        title: "New Title",
        ingredients: [{ name: "eggs" }],
        steps: ["Whisk eggs"],
      });

      expect(next[0].title).toBe("New Title");
      expect(next[0].ingredients).toEqual([{ name: "eggs" }]);
      expect(next[0].steps).toEqual(["Whisk eggs"]);
    });

    it("preserves fields the update payload does not carry", () => {
      // `updateRecipe` returns title/ingredients/steps only. Everything else on
      // the entry — notably tags — has to survive the patch untouched, since
      // clobbering it would show the user wrong data rather than stale data.
      const entry = makeEntry({
        recipeId: "recipe-a",
        tags: ["italian", "quick"],
        savedAt: new Date("2024-05-05"),
        thumbnailUrl: "https://example.com/keep.jpg",
      });

      const next = applyOptimisticAction([entry], {
        type: "update",
        recipeId: "recipe-a",
        title: "Renamed",
        ingredients: [{ name: "eggs" }],
        steps: ["Whisk eggs"],
      });

      expect(next[0].tags).toEqual(["italian", "quick"]);
      expect(next[0].savedAt).toEqual(new Date("2024-05-05"));
      expect(next[0].thumbnailUrl).toBe("https://example.com/keep.jpg");
      expect(next[0].id).toBe(entry.id);
      expect(next[0].slug).toBe(entry.slug);
    });

    it("does not touch sibling entries", () => {
      const untouched = makeEntry({ id: "b", recipeId: "recipe-b", title: "Keep Me" });
      const state = [makeEntry({ id: "a", recipeId: "recipe-a" }), untouched];

      const next = applyOptimisticAction(state, {
        type: "update",
        recipeId: "recipe-a",
        title: "Renamed",
        ingredients: [{ name: "eggs" }],
        steps: ["Whisk eggs"],
      });

      expect(next[1]).toBe(untouched);
      expect(next).toHaveLength(2);
    });

    it("leaves the list unchanged when no entry matches", () => {
      const state = [makeEntry({ recipeId: "recipe-a", title: "Original" })];

      const next = applyOptimisticAction(state, {
        type: "update",
        recipeId: "recipe-missing",
        title: "Renamed",
        ingredients: [{ name: "eggs" }],
        steps: ["Whisk eggs"],
      });

      expect(next[0].title).toBe("Original");
    });

    it("does not mutate the input state", () => {
      const state = [makeEntry({ recipeId: "recipe-a", title: "Original" })];

      applyOptimisticAction(state, {
        type: "update",
        recipeId: "recipe-a",
        title: "Renamed",
        ingredients: [{ name: "eggs" }],
        steps: ["Whisk eggs"],
      });

      expect(state[0].title).toBe("Original");
    });
  });
});

// ─── Invariants ──────────────────────────────────────────────────────────────

const entryArb = fc.record({
  id: fc.uuid(),
  recipeId: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  slug: fc.string({ minLength: 12, maxLength: 12 }),
  creatorHandle: fc.string({ minLength: 1, maxLength: 24 }),
  creatorDisplayName: fc.constant(undefined),
  thumbnailUrl: fc.constant(undefined),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
  ingredients: fc.array(
    fc.record({ name: fc.string({ minLength: 1, maxLength: 50 }) }),
    { minLength: 1, maxLength: 5 }
  ),
  steps: fc.array(fc.string({ minLength: 1, maxLength: 200 }), {
    minLength: 1,
    maxLength: 5,
  }),
  savedAt: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2026-12-31"),
    noInvalidDate: true,
  }),
});

/** Distinct recipeIds, so "the matching entry" is unambiguous. */
const entryListArb = fc
  .array(entryArb, { minLength: 1, maxLength: 8 })
  .map((entries) =>
    entries.filter(
      (entry, i) => entries.findIndex((e) => e.recipeId === entry.recipeId) === i
    )
  );

describe("applyOptimisticAction invariants", () => {
  it("update preserves list length and every entry's identity and tags", () => {
    fc.assert(
      fc.property(
        entryListArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.nat(),
        (entries, newTitle, targetIndex) => {
          const target = entries[targetIndex % entries.length];

          const next = applyOptimisticAction(entries, {
            type: "update",
            recipeId: target.recipeId,
            title: newTitle,
            ingredients: [{ name: "patched" }],
            steps: ["patched"],
          });

          expect(next).toHaveLength(entries.length);

          next.forEach((entry, i) => {
            // A patch may change what a recipe says, never which recipe it is,
            // and never its tags — which the payload cannot speak to.
            expect(entry.id).toBe(entries[i].id);
            expect(entry.recipeId).toBe(entries[i].recipeId);
            expect(entry.tags).toEqual(entries[i].tags);
            expect(entry.savedAt).toEqual(entries[i].savedAt);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("update changes the title of exactly one entry", () => {
    fc.assert(
      fc.property(
        entryListArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.nat(),
        (entries, newTitle, targetIndex) => {
          const target = entries[targetIndex % entries.length];

          const next = applyOptimisticAction(entries, {
            type: "update",
            recipeId: target.recipeId,
            title: newTitle,
            ingredients: [{ name: "patched" }],
            steps: ["patched"],
          });

          next.forEach((entry, i) => {
            const expected =
              entry.recipeId === target.recipeId ? newTitle : entries[i].title;
            expect(entry.title).toBe(expected);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("remove always shrinks the list by exactly the matching entry", () => {
    fc.assert(
      fc.property(entryListArb, fc.nat(), (entries, targetIndex) => {
        const target = entries[targetIndex % entries.length];

        const next = applyOptimisticAction(entries, {
          type: "remove",
          recipeId: target.recipeId,
        });

        expect(next).toHaveLength(entries.length - 1);
        expect(next.some((e) => e.recipeId === target.recipeId)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
