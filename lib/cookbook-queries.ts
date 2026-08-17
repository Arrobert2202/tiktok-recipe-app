import { db } from "@/db";
import { cookbookEntries, recipes } from "@/db/schema";
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import type { Ingredient } from "@/lib/types";

export type CookbookSortField = "savedAt" | "title" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface CookbookEntry {
  id: string;
  recipeId: string;
  title: string;
  slug: string;
  creatorHandle: string;
  creatorDisplayName?: string;
  thumbnailUrl?: string;
  tags: string[];
  ingredients: { name: string; quantity?: string; unit?: string }[];
  /**
   * Carried so the cookbook can seed the edit modal without a second fetch.
   * `updateRecipe` rewrites the whole recipe, and `validateRecipeEdit` rejects
   * an empty steps array, so an entry without steps could not be edited at all.
   */
  steps: string[];
  savedAt: Date;
}

export interface CookbookQueryOptions {
  sort?: CookbookSortField;
  direction?: SortDirection;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;

export async function getUserCookbook(
  userId: string,
  options?: CookbookQueryOptions
): Promise<CookbookEntry[]> {
  const sort = options?.sort ?? "savedAt";
  const direction = options?.direction ?? (sort === "title" ? "asc" : "desc");
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const orderFn = direction === "asc" ? asc : desc;

  let orderByColumn;
  switch (sort) {
    case "title":
      orderByColumn = orderFn(recipes.title);
      break;
    case "createdAt":
      orderByColumn = orderFn(recipes.createdAt);
      break;
    case "savedAt":
    default:
      orderByColumn = orderFn(cookbookEntries.savedAt);
      break;
  }

  const rows = await db
    .select({
      id: cookbookEntries.id,
      recipeId: cookbookEntries.recipeId,
      title: recipes.title,
      slug: recipes.slug,
      creatorHandle: recipes.creatorHandle,
      creatorDisplayName: recipes.creatorDisplayName,
      thumbnailUrl: recipes.thumbnailUrl,
      tags: cookbookEntries.tags,
      ingredients: recipes.ingredients,
      steps: recipes.steps,
      savedAt: cookbookEntries.savedAt,
    })
    .from(cookbookEntries)
    .innerJoin(recipes, eq(cookbookEntries.recipeId, recipes.id))
    .where(eq(cookbookEntries.userId, userId))
    .orderBy(orderByColumn)
    .limit(pageSize)
    .offset(offset);

  return rows.map((row) => ({
    id: row.id,
    recipeId: row.recipeId,
    title: row.title,
    slug: row.slug,
    creatorHandle: row.creatorHandle,
    creatorDisplayName: row.creatorDisplayName ?? undefined,
    thumbnailUrl: row.thumbnailUrl ?? undefined,
    tags: row.tags,
    ingredients: row.ingredients,
    steps: row.steps ?? [],
    savedAt: row.savedAt,
  }));
}

export async function searchCookbook(
  userId: string,
  query: string
): Promise<CookbookEntry[]> {
  if (!query.trim()) {
    return getUserCookbook(userId);
  }

  const lowerQuery = query.toLowerCase();

  // Fetch all cookbook entries for the user, then filter in-memory.
  // This approach is acceptable for <500 recipes per user and avoids
  // complex PostgreSQL JSONB queries for ingredient/tag matching.
  const allEntries = await db
    .select({
      id: cookbookEntries.id,
      recipeId: cookbookEntries.recipeId,
      title: recipes.title,
      slug: recipes.slug,
      creatorHandle: recipes.creatorHandle,
      creatorDisplayName: recipes.creatorDisplayName,
      thumbnailUrl: recipes.thumbnailUrl,
      tags: cookbookEntries.tags,
      ingredients: recipes.ingredients,
      steps: recipes.steps,
      savedAt: cookbookEntries.savedAt,
    })
    .from(cookbookEntries)
    .innerJoin(recipes, eq(cookbookEntries.recipeId, recipes.id))
    .where(eq(cookbookEntries.userId, userId))
    .orderBy(desc(cookbookEntries.savedAt));

  return allEntries
    .filter((row) => {
      // Check title
      if (row.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Check ingredient names
      if (
        row.ingredients.some((ing) =>
          ing.name.toLowerCase().includes(lowerQuery)
        )
      ) {
        return true;
      }

      // Check tags
      if (row.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }

      return false;
    })
    .map((row) => ({
      id: row.id,
      recipeId: row.recipeId,
      title: row.title,
      slug: row.slug,
      creatorHandle: row.creatorHandle,
      creatorDisplayName: row.creatorDisplayName ?? undefined,
      thumbnailUrl: row.thumbnailUrl ?? undefined,
      tags: row.tags,
      ingredients: row.ingredients,
      steps: row.steps ?? [],
      savedAt: row.savedAt,
    }));
}
export interface CookbookRecipeIngredients {
  recipeId: string;
  title: string;
  ingredients: Ingredient[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads title + ingredients for the given recipe IDs, scoped to recipes that
 * are actually in this user's cookbook. The join through `cookbookEntries`
 * with a `userId` filter is what stops a user enumerating arbitrary recipe IDs
 * via the query string.
 */
export async function getCookbookRecipesByIds(
  userId: string,
  recipeIds: string[]
): Promise<CookbookRecipeIngredients[]> {
  // Drop anything that isn't a well-formed UUID before it reaches Postgres.
  const validIds = Array.from(
    new Set(recipeIds.filter((id) => UUID_PATTERN.test(id)))
  );

  if (validIds.length === 0) return [];

  const rows = await db
    .select({
      recipeId: recipes.id,
      title: recipes.title,
      ingredients: recipes.ingredients,
    })
    .from(cookbookEntries)
    .innerJoin(recipes, eq(cookbookEntries.recipeId, recipes.id))
    .where(
      and(
        eq(cookbookEntries.userId, userId),
        inArray(cookbookEntries.recipeId, validIds)
      )
    )
    .orderBy(desc(cookbookEntries.savedAt));

  return rows.map((row) => ({
    recipeId: row.recipeId,
    title: row.title,
    ingredients: row.ingredients ?? [],
  }));
}
