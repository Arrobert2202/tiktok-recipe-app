import type { Ingredient } from "@/lib/types";

/**
 * schema.org Recipe JSON-LD builder for the public share page.
 *
 * Tips note: schema.org has no `recipeTips` property. `recipeInstructions`
 * accepts CreativeWork values, and `HowToTip` is a real schema.org type
 * (a CreativeWork / HowToItem subtype), so tips are appended to
 * `recipeInstructions` as HowToTip entries. That keeps everything inside the
 * published vocabulary — search engines that only understand HowToStep simply
 * ignore the tips instead of choking on an invented property.
 */

export interface HowToStepJsonLd {
  "@type": "HowToStep";
  position: number;
  text: string;
}

export interface HowToTipJsonLd {
  "@type": "HowToTip";
  position: number;
  text: string;
}

export interface RecipeJsonLd {
  "@context": "https://schema.org";
  "@type": "Recipe";
  name: string;
  author: {
    "@type": "Person";
    name: string;
    url?: string;
  };
  recipeIngredient: string[];
  recipeInstructions: (HowToStepJsonLd | HowToTipJsonLd)[];
  image?: string;
  datePublished?: string;
  dateModified?: string;
  url: string;
  isAccessibleForFree: true;
}

export interface RecipeSchemaInput {
  slug: string;
  title: string;
  creatorHandle: string;
  creatorProfileUrl?: string | null;
  ingredients: Ingredient[];
  steps: string[];
  tipsAndTricks?: string[] | null;
  thumbnailUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  /** Overrides NEXT_PUBLIC_APP_URL, mainly for tests. */
  appUrl?: string;
}

const DEFAULT_APP_URL = "http://localhost:3000";

/**
 * Builds a schema.org Recipe object ready for JSON.stringify into a
 * <script type="application/ld+json"> tag. Optional fields are omitted
 * entirely rather than emitted as null.
 */
export function buildRecipeJsonLd(recipe: RecipeSchemaInput): RecipeJsonLd {
  const appUrl = trimTrailingSlash(
    recipe.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL
  );

  const profileUrl = (recipe.creatorProfileUrl ?? "").trim();
  const thumbnailUrl = (recipe.thumbnailUrl ?? "").trim();

  const steps = (recipe.steps ?? [])
    .map((step) => (step ?? "").trim())
    .filter((step) => step.length > 0);

  const tips = (recipe.tipsAndTricks ?? [])
    .map((tip) => (tip ?? "").trim())
    .filter((tip) => tip.length > 0);

  const datePublished = toIsoString(recipe.createdAt);
  const dateModified = toIsoString(recipe.updatedAt);

  const recipeInstructions: (HowToStepJsonLd | HowToTipJsonLd)[] = [
    ...steps.map((text, index) => ({
      "@type": "HowToStep" as const,
      position: index + 1,
      text,
    })),
    ...tips.map((text, index) => ({
      "@type": "HowToTip" as const,
      position: steps.length + index + 1,
      text,
    })),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    author: {
      "@type": "Person",
      name: `@${recipe.creatorHandle}`,
      ...(profileUrl && { url: profileUrl }),
    },
    recipeIngredient: (recipe.ingredients ?? [])
      .map(formatIngredient)
      .filter((line) => line.length > 0),
    recipeInstructions,
    ...(thumbnailUrl && { image: thumbnailUrl }),
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    url: `${appUrl}/r/${recipe.slug}`,
    isAccessibleForFree: true,
  };
}

/** "quantity unit name", with blank parts dropped. */
export function formatIngredient(ingredient: Ingredient): string {
  return [ingredient?.quantity, ingredient?.unit, ingredient?.name]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

function toIsoString(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
