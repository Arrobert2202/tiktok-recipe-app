import type { CookbookEntry } from "@/lib/cookbook-queries";

/**
 * Optimistic mutations the cookbook grid applies to its entry list while a
 * server action is in flight.
 *
 * `update` deliberately carries no `tags`: it is fed from `updateRecipe`'s
 * result, which returns title/ingredients/steps only. Tag changes are picked up
 * by the refetch the grid issues alongside the dispatch.
 */
export type OptimisticAction =
  | { type: "remove"; recipeId: string }
  | {
      type: "update";
      recipeId: string;
      title: string;
      ingredients: CookbookEntry["ingredients"];
      steps: string[];
    };

/**
 * Pure reducer behind the grid's `useOptimistic`. Entries are addressed by
 * `recipeId` rather than the cookbook entry `id`, because that is the identifier
 * both `removeRecipeFromCookbook` and `updateRecipe` speak in.
 */
export function applyOptimisticAction(
  state: CookbookEntry[],
  action: OptimisticAction
): CookbookEntry[] {
  switch (action.type) {
    case "remove":
      return state.filter((entry) => entry.recipeId !== action.recipeId);

    case "update":
      return state.map((entry) =>
        entry.recipeId === action.recipeId
          ? {
              ...entry,
              title: action.title,
              ingredients: action.ingredients,
              steps: action.steps,
            }
          : entry
      );

    default:
      return state;
  }
}
