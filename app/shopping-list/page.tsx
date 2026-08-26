import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCookbookRecipesByIds } from "@/lib/cookbook-queries";
import { mergeIngredients } from "@/lib/shopping-list";
import { ShoppingListView } from "@/components/shopping-list-view";
import { ShoppingListEmpty } from "@/components/shopping-list-empty";

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
    return <ShoppingListEmpty />;
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
