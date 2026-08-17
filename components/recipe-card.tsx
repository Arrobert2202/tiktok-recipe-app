"use client";

import Link from "next/link";
import { Check, Pencil } from "lucide-react";
import type { CookbookEntry } from "@/lib/cookbook-queries";

interface RecipeCardProps {
  entry: CookbookEntry;
  onRemove: (recipeId: string) => void;
  isRemoving?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (recipeId: string) => void;
  /**
   * Opens the edit modal for this entry. Omitted by callers that have no edit
   * affordance; the trigger is hidden in selection mode either way, where the
   * whole card is a selection toggle.
   */
  onEdit?: (entry: CookbookEntry) => void;
}

export function RecipeCard({
  entry,
  onRemove,
  isRemoving,
  selectable = false,
  selected = false,
  onToggleSelect,
  onEdit,
}: RecipeCardProps) {
  const thumbnail = entry.thumbnailUrl ? (
    <img
      src={entry.thumbnailUrl}
      alt={entry.title}
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="h-full w-full bg-gradient-to-br from-purple-900/50 via-pink-900/30 to-indigo-900/50 flex items-center justify-center">
      <span className="text-3xl">🍳</span>
    </div>
  );

  const cardClasses = `group relative rounded-2xl border bg-white/5 backdrop-blur-sm transition-all ${
    selectable && selected
      ? "border-purple-500/60 scale-[1.02] shadow-lg shadow-purple-500/10"
      : "border-white/10 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5"
  } ${isRemoving ? "opacity-50 scale-95" : ""}`;

  // ─── Selection mode: the whole card toggles selection, no navigation ───
  if (selectable) {
    return (
      <div className={cardClasses}>
        <button
          type="button"
          onClick={() => onToggleSelect?.(entry.recipeId)}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${entry.title}`}
          className="block w-full cursor-pointer text-left"
        >
          <div className="relative h-40 w-full overflow-hidden rounded-t-2xl">
            {thumbnail}
            <div
              className={`absolute inset-0 transition-colors ${
                selected ? "bg-purple-500/20" : "bg-transparent"
              }`}
            />
          </div>

          <div className="p-4">
            <h3 className="text-sm font-semibold text-white line-clamp-2">
              {entry.title}
            </h3>
            <p className="mt-1 text-xs text-white/50">@{entry.creatorHandle}</p>
            <p className="mt-1 text-xs text-white/30">
              {entry.ingredients.length}{" "}
              {entry.ingredients.length === 1 ? "ingredient" : "ingredients"}
            </p>
          </div>
        </button>

        {/* Checkbox overlay */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-lg border-2 backdrop-blur-sm transition-colors ${
            selected
              ? "border-transparent bg-gradient-to-br from-purple-500 to-pink-500"
              : "border-white/40 bg-black/40"
          }`}
        >
          {selected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
        </div>
      </div>
    );
  }

  // ─── Default mode ─────────────────────────────────────────────────────
  return (
    <div className={cardClasses}>
      {/* Thumbnail */}
      <Link href={`/recipe/${entry.recipeId}`} className="block">
        <div className="relative h-40 w-full overflow-hidden rounded-t-2xl">
          {thumbnail}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={`/recipe/${entry.recipeId}`}>
          <h3 className="text-sm font-semibold text-white line-clamp-2 hover:text-purple-400 transition-colors">
            {entry.title}
          </h3>
        </Link>

        <p className="mt-1 text-xs text-white/50">@{entry.creatorHandle}</p>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {entry.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70"
              >
                {tag}
              </span>
            ))}
            {entry.tags.length > 3 && (
              <span className="inline-flex items-center text-xs text-white/40">
                +{entry.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {onEdit && (
          <button
            onClick={() => onEdit(entry)}
            className="rounded-full bg-black/50 backdrop-blur-sm p-1.5 text-white/40 opacity-0 shadow-sm transition-opacity hover:text-purple-400 group-hover:opacity-100 focus:opacity-100"
            aria-label={`Edit ${entry.title}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={() => onRemove(entry.recipeId)}
          disabled={isRemoving}
          className="rounded-full bg-black/50 backdrop-blur-sm p-1.5 text-white/40 opacity-0 shadow-sm transition-opacity hover:text-red-400 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed"
          aria-label={`Remove ${entry.title} from cookbook`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
