"use client";

import { useState, useMemo, useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, X } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { EditModal } from "@/components/edit-modal";
import { removeRecipeFromCookbook } from "@/actions/cookbook";
import { applyOptimisticAction } from "@/lib/cookbook-grid-state";
import type { CookbookEntry, CookbookSortField } from "@/lib/cookbook-queries";
import type { Ingredient } from "@/lib/types";

interface CookbookGridProps {
  initialEntries: CookbookEntry[];
}

type SortOption = {
  label: string;
  field: CookbookSortField;
};

const SORT_OPTIONS: SortOption[] = [
  { label: "Recently Saved", field: "savedAt" },
  { label: "Title", field: "title" },
  { label: "Date Added", field: "createdAt" },
];

function sortEntries(
  entries: CookbookEntry[],
  sort: CookbookSortField
): CookbookEntry[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title);
      case "createdAt":
        return b.savedAt.getTime() - a.savedAt.getTime();
      case "savedAt":
      default:
        return b.savedAt.getTime() - a.savedAt.getTime();
    }
  });
}

function filterEntries(
  entries: CookbookEntry[],
  query: string
): CookbookEntry[] {
  if (!query.trim()) return entries;
  const lower = query.toLowerCase();
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(lower) ||
      entry.ingredients.some((ing) =>
        ing.name.toLowerCase().includes(lower)
      ) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}

export function CookbookGrid({ initialEntries }: CookbookGridProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSort, setActiveSort] = useState<CookbookSortField>("savedAt");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingEntry, setEditingEntry] = useState<CookbookEntry | null>(null);
  const [, startTransition] = useTransition();

  const [optimisticEntries, dispatchOptimistic] = useOptimistic(
    initialEntries,
    applyOptimisticAction
  );

  const filtered = filterEntries(optimisticEntries, searchQuery);
  const sorted = sortEntries(filtered, activeSort);

  async function handleRemove(recipeId: string) {
    setRemovingIds((prev) => new Set(prev).add(recipeId));
    startTransition(async () => {
      dispatchOptimistic({ type: "remove", recipeId });
      await removeRecipeFromCookbook(recipeId);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(recipeId);
        return next;
      });
    });
  }

  /**
   * EditModal re-seeds its form whenever `initialData` changes identity, so an
   * inline literal rebuilt on every parent render would discard in-progress
   * edits. Keyed on the entry being edited, which only changes when the modal
   * opens on a different card.
   */
  const editInitialData = useMemo(() => {
    if (!editingEntry) return null;
    return {
      title: editingEntry.title,
      ingredients: editingEntry.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity ?? "",
        unit: ingredient.unit ?? "",
      })),
      steps: editingEntry.steps,
      tags: editingEntry.tags,
    };
  }, [editingEntry]);

  function handleSaved(recipe: {
    id: string;
    title: string;
    ingredients: Ingredient[];
    steps: string[];
  }) {
    setEditingEntry(null);

    startTransition(() => {
      // Patches the card in place so the new title shows without waiting on a
      // round trip. `recipe.id` is the recipe ID, which is what entries key on.
      dispatchOptimistic({
        type: "update",
        recipeId: recipe.id,
        title: recipe.title,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      });

      // `onSaved` does not report tags, and EditModal owns the tag state, so
      // there is no way here to know either the new tags or whether they
      // changed. Refetching is the only honest way to get the chips right, so
      // it runs unconditionally. Issuing it inside this transition is what
      // makes it cheap to the eye: `useOptimistic` holds the patched title
      // until the transition settles, so the card shows the new title
      // immediately and the fresh row lands underneath it without a flash.
      router.refresh();
    });
  }

  function toggleSelect(recipeId: string) {
    setSelectedIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  }

  function toggleSelectionMode() {
    setIsSelecting((prev) => {
      // Leaving selection mode always clears the selection.
      if (prev) setSelectedIds([]);
      return !prev;
    });
  }

  const shoppingListHref = `/shopping-list?ids=${selectedIds.join(",")}`;

  return (
    <div>
      {/* Search and Sort Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by title, ingredient, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
          />
        </div>

        {/* Sort + Select Controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-white/40 mr-1">Sort:</span>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.field}
              onClick={() => setActiveSort(option.field)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeSort === option.field
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/70"
              }`}
            >
              {option.label}
            </button>
          ))}

          <button
            onClick={toggleSelectionMode}
            aria-pressed={isSelecting}
            className={`ml-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelecting
                ? "border-purple-500/40 bg-purple-500/15 text-purple-200"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {isSelecting ? (
              <>
                <X className="h-3.5 w-3.5" />
                Cancel
              </>
            ) : (
              <>
                <CheckSquare className="h-3.5 w-3.5" />
                Select
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {searchQuery ? (
            <>
              <p className="text-white/50 text-sm">
                No recipes match &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-white/50 text-sm">
                Your cookbook is empty.
              </p>
              <p className="mt-1 text-white/30 text-xs">
                Extract a recipe from a TikTok video to get started.
              </p>
            </>
          )}
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
            selectedIds.length > 0 ? "pb-28" : ""
          }`}
        >
          {sorted.map((entry) => (
            <RecipeCard
              key={entry.id}
              entry={entry}
              onRemove={handleRemove}
              isRemoving={removingIds.has(entry.recipeId)}
              selectable={isSelecting}
              selected={selectedIds.includes(entry.recipeId)}
              onToggleSelect={toggleSelect}
              onEdit={setEditingEntry}
            />
          ))}
        </div>
      )}

      {/* Sticky selection bar */}
      {isSelecting && selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-white">
                {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "recipe" : "recipes"} selected
              </span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>

            <Link
              href={shoppingListHref}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/40 active:scale-95"
            >
              🛒 Shopping List
            </Link>
          </div>
        </div>
      )}

      {/*
        Every row in a user's cookbook belongs to that user, so there is no
        ownership check to make here — the edit affordance is always available.
      */}
      {editingEntry && editInitialData && (
        <EditModal
          recipeId={editingEntry.recipeId}
          initialData={editInitialData}
          isOpen={true}
          onClose={() => setEditingEntry(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
