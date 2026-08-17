import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { recipes } from "@/db/schema";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Upper bound on recipe entries so the sitemap stays well under the 50k limit. */
const MAX_RECIPE_ENTRIES = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: appUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${appUrl}/creators`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${appUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${appUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    // Only public recipes. Opted-out creators have isPublic flipped to false,
    // so this filter is what keeps their content out of the index.
    const publicRecipes = await db
      .select({ slug: recipes.slug, updatedAt: recipes.updatedAt })
      .from(recipes)
      .where(eq(recipes.isPublic, true))
      .orderBy(desc(recipes.updatedAt))
      .limit(MAX_RECIPE_ENTRIES);

    const recipeEntries: MetadataRoute.Sitemap = publicRecipes.map((recipe) => ({
      url: `${appUrl}/r/${recipe.slug}`,
      lastModified: recipe.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticEntries, ...recipeEntries];
  } catch (error) {
    // A database hiccup must not break the sitemap build. Serve the static
    // routes and let the next revalidation pick up the recipes.
    console.error("[sitemap] failed to load public recipes", error);
    return staticEntries;
  }
}
