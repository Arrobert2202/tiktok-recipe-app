import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCookbookRecipesByIds } from "@/lib/cookbook-queries";
import { mergeIngredients } from "@/lib/shopping-list";
import { ShoppingListView } from "@/components/shopping-list-view";

interface ShoppingListPageProps {
  // Next.js 16: searchParams is async.
  searchParams: Promise<{ ids?: string | string[] }>;
}

function parseIds(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const joined = Array.isArray(raw) ? raw.join(",") : raw;
  return joined
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export default async function ShoppingListPage({
  searchParams,
}: ShoppingListPageProps) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/auth/signin?callbackUrl=/shopping-list");
  }

  const { ids } = await searchParams;
  const recipeIds = parseIds(ids);

  // Scoped to the user's own cookbook — arbitrary recipe IDs return nothing.
  const recipes =
    recipeIds.length > 0
      ? await getCookbookRecipesByIds(session.user.id, recipeIds)
      : [];

  if (recipes.length === 0) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-bold text-white">Shopping List</h1>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center backdrop-blur-sm">
            <span className="text-4xl">🛒</span>
            <p className="mt-4 text-sm text-white/70">
              No recipes selected yet.
            </p>
            <p className="mt-1 text-xs text-white/40">
              Pick recipes from your cookbook to build a combined shopping list.
            </p>
            <Link
              href="/cookbook"
              className="mt-6 inline-block rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/40 active:scale-95"
            >
              Go to Cookbook
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const items = mergeIngredients(
    recipes.map((recipe) => ({
      title: recipe.title,
      ingredients: recipe.ingredients,
    }))
  );

  return (
    <ShoppingListView
      items={items}
      recipeIds={recipes.map((recipe) => recipe.recipeId)}
      recipeCount={recipes.length}
    />
  );
}
