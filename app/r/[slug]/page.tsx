import { notFound } from "next/navigation";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { VideoEmbed } from "@/components/video-embed";
import { AttributionBlock } from "@/components/attribution-block";
import { IngredientList } from "@/components/ingredient-list";
import { StepList } from "@/components/step-list";
import { ShareButton } from "@/components/share-button";
import { RecipeCardDownload } from "@/components/recipe-card-download";
import { SaveRecipeCta } from "@/components/save-recipe-cta";
import { RecipeSectionHeading } from "@/components/recipe-section-heading";
import { RecipeOptedOutNotice } from "@/components/recipe-opted-out-notice";
import { buildRecipeJsonLd } from "@/lib/recipe-schema";
import type { Ingredient } from "@/lib/types";
import type { Metadata } from "next";

interface SharePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { slug } = await params;

  const [recipe] = await db
    .select({ title: recipes.title, isPublic: recipes.isPublic })
    .from(recipes)
    .where(eq(recipes.slug, slug));

  if (!recipe) {
    return { title: "Recipe Not Found" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    title: recipe.title,
    description: `Recipe: ${recipe.title} - extracted from TikTok`,
    openGraph: {
      title: recipe.title,
      description: `Recipe: ${recipe.title} - extracted from TikTok`,
      images: [`${appUrl}/api/og/${slug}`],
      url: `${appUrl}/r/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: recipe.title,
      description: `Recipe: ${recipe.title} - extracted from TikTok`,
      images: [`${appUrl}/api/og/${slug}`],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { slug } = await params;

  const [recipe] = await db.select().from(recipes).where(eq(recipes.slug, slug));

  if (!recipe) {
    notFound();
  }

  const ingredients = recipe.ingredients as Ingredient[];
  const steps = recipe.steps as string[];
  const tipsAndTricks = (recipe.tipsAndTricks as string[] | null) ?? [];

  if (!recipe.isPublic) {
    return <RecipeOptedOutNotice />;
  }

  // Reached only for public recipes — the opt-out guard above returns early,
  // so no structured data is ever emitted for an opted-out creator.
  const jsonLd = buildRecipeJsonLd({
    slug: recipe.slug,
    title: recipe.title,
    creatorHandle: recipe.creatorHandle,
    creatorProfileUrl: recipe.creatorProfileUrl,
    ingredients,
    steps,
    tipsAndTricks,
    thumbnailUrl: recipe.thumbnailUrl,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  });

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <VideoEmbed sourceUrl={recipe.sourceUrl} />

        <div className="mt-4">
          <AttributionBlock
            creatorHandle={recipe.creatorHandle}
            creatorProfileUrl={recipe.creatorProfileUrl}
            creatorDisplayName={recipe.creatorDisplayName}
          />
        </div>

        <h1 className="mt-6 text-2xl font-bold text-white">
          {recipe.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ShareButton slug={recipe.slug} title={recipe.title} variant="solid" />
          <RecipeCardDownload slug={recipe.slug} />
        </div>

        <section className="mt-6">
          <RecipeSectionHeading
            translationKey="recipeDetail.ingredients"
            className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3"
          />
          <IngredientList ingredients={ingredients} recipeId={recipe.id} />
        </section>

        <section className="mt-6">
          <RecipeSectionHeading
            translationKey="recipeDetail.steps"
            className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3"
          />
          <StepList steps={steps} />
        </section>

        {tipsAndTricks.length > 0 && (
          <section className="mt-8">
            <RecipeSectionHeading
              translationKey="recipeDetail.tipsAndTricks"
              className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4"
            />
            <div className="space-y-3">
              {tipsAndTricks.map((tip, index) => (
                <div key={index} className="flex gap-3 items-start backdrop-blur-sm bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3">
                  <span className="text-amber-400 text-lg mt-0.5">💡</span>
                  <p className="text-white/80 text-[15px] leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8">
          <SaveRecipeCta recipeId={recipe.id} slug={recipe.slug} />
        </div>
      </div>
    </main>
  );
}
