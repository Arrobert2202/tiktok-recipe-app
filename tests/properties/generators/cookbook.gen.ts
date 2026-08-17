import fc from "fast-check";

/**
 * Shared fast-check generators (arbitraries) for cookbook entries and tags.
 * Aligned with the validation rules in lib/validation.ts.
 *
 * Validates: Requirements 6.5
 */

// Generate valid tags: 1-50 characters
export const validTag = fc.string({ minLength: 1, maxLength: 50 });

// Generate invalid tags: empty or exceeding 50 chars
export const invalidTag = fc.oneof(
  fc.constant(""),
  fc.string({ minLength: 51, maxLength: 100 })
);

// Generate a valid tag list (0-20 tags, each 1-50 chars)
export const tagList = fc.array(validTag, { minLength: 0, maxLength: 20 });

// Generate a tag list that exceeds the 20-tag maximum
export const tooManyTags = fc.array(validTag, { minLength: 21, maxLength: 30 });

// Generate a cookbook entry with tags for testing search/filter scenarios
export const cookbookEntry = fc.record({
  recipeTitle: fc.string({ minLength: 1, maxLength: 200 }),
  tags: tagList,
  // `noInvalidDate: true` is required: fc.date() can produce `new Date(NaN)`
  // even when `min`/`max` are supplied, which breaks date comparisons.
  savedAt: fc.date({
    min: new Date("2024-01-01"),
    max: new Date("2025-12-31"),
    noInvalidDate: true,
  }),
});

// Generate a list of cookbook entries for testing sort and search
export const cookbookEntries = fc.array(cookbookEntry, {
  minLength: 1,
  maxLength: 50,
});

// Generate a search query by picking a substring from a potential recipe title
export const searchQuery = fc.string({ minLength: 1, maxLength: 50 });
