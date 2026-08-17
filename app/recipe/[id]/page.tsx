import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db";
import { recipes, cookbookEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { VideoEmbed } from "@/components/video-embed";
import { AttributionBlock } from "@/components/attribution-block";
import { IngredientList } from "@/components/ingredient-list";
import { StepList } from "@/components/step-list";
import {
  RecipePageClient,
  EditRecipeButton,
} from "@/components/recipe-page-client";
import { ShareButton } from "@/components/share-button";
import { RecipeCardDownload } from "@/components/recipe-card-download";
import { SaveRecipeCta } from "@/components/save-recipe-cta";
import type { Ingredient } from "@/lib/types";

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, id));

  if (!recipe) {
    notFound();
  }

  const ingredients = recipe.ingredients as Ingredient[];
  const steps = recipe.steps as string[];
  const tipsAndTricks = (recipe.tipsAndTricks as string[] | null) ?? [];

  // Editing is scoped to recipes the viewer has saved, matching the ownership
  // check in `updateRecipe`. Tags live on the cookbook entry, so the same
  // lookup supplies the modal's initial tag list.
  const session = await auth.api.getSession({ headers: await headers() });

  const [entry] = session
    ? await db
        .select({ tags: cookbookEntries.tags })
        .from(cookbookEntries)
        .where(
          and(
            eq(cookbookEntries.userId, session.user.id),
            eq(cookbookEntries.recipeId, recipe.id)
          )
        )
    : [];

  const canEdit = !!entry;

  return (
    <RecipePageClient
      recipe={{
        id: recipe.id,
        title: recipe.title,
        sourceUrl: recipe.sourceUrl,
        creatorHandle: recipe.creatorHandle,
        creatorProfileUrl: recipe.creatorProfileUrl,
        creatorDisplayName: recipe.creatorDisplayName,
      }}
      ingredients={ingredients}
      steps={steps}
      canEdit={canEdit}
      initialTags={entry?.tags ?? []}
    >
      <main className="min-h-screen pb-24">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:grid lg:grid-cols-[1fr_420px] lg:gap-10">
          {/* Left column: Video + Attribution */}
          <div className="lg:order-1">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-3 shadow-xl">
              <VideoEmbed sourceUrl={recipe.sourceUrl} />
            </div>
            <div className="mt-4">
              <AttributionBlock
                creatorHandle={recipe.creatorHandle}
                creatorProfileUrl={recipe.creatorProfileUrl}
                creatorDisplayName={recipe.creatorDisplayName}
              />
            </div>
          </div>

          {/* Right column / below on mobile: Recipe content */}
          <div className="mt-8 lg:mt-0 lg:order-2">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
              <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
                {recipe.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <ShareButton
                  slug={recipe.slug}
                  title={recipe.title}
                  variant="ghost"
                />
                <RecipeCardDownload slug={recipe.slug} />
                {canEdit && <EditRecipeButton />}
              </div>

              <div className="mb-8">
                <SaveRecipeCta recipeId={recipe.id} slug={recipe.slug} />
              </div>

              <section className="mb-8">
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
                  Ingredients
                </h2>
                <IngredientList ingredients={ingredients} recipeId={recipe.id} />
              </section>

              <section>
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
                  Steps
                </h2>
                <StepList steps={steps} />
              </section>

              {tipsAndTricks.length > 0 && (
                <section className="mt-8">
                  <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
                    Tips &amp; Tricks
                  </h2>
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
            </div>
          </div>
        </div>
      </main>
    </RecipePageClient>
  );
}
