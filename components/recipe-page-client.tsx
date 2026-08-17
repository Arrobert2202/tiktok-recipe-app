"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Play } from "lucide-react";
import { CookMode } from "@/components/cook-mode";
import { EditModal } from "@/components/edit-modal";
import type { Ingredient } from "@/lib/types";

interface RecipePageClientProps {
  recipe: {
    id: string;
    title: string;
    sourceUrl: string;
    creatorHandle: string;
    creatorProfileUrl: string;
    creatorDisplayName?: string | null;
  };
  ingredients: Ingredient[];
  steps: string[];
  /**
   * True only when the recipe is in the signed-in viewer's cookbook. The
   * `updateRecipe` action rejects anyone else, so the trigger stays hidden
   * rather than offering an edit that is guaranteed to fail.
   */
  canEdit: boolean;
  /** Tags from the viewer's cookbook entry; empty when there is no entry. */
  initialTags: string[];
  children: React.ReactNode;
}

interface RecipeEditContextValue {
  /** Null when the viewer cannot edit, which hides the trigger entirely. */
  openEdit: (() => void) | null;
}

/**
 * The recipe page composes its content on the server and passes it in as
 * `children`, so the Edit trigger sitting in that button row can't reach the
 * modal state through props. This context bridges the two.
 */
const RecipeEditContext = createContext<RecipeEditContextValue>({
  openEdit: null,
});

export function RecipePageClient({
  recipe,
  ingredients,
  steps,
  canEdit,
  initialTags,
  children,
}: RecipePageClientProps) {
  const router = useRouter();
  const [cookModeOpen, setCookModeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // EditModal re-seeds its form whenever `initialData` changes identity, so a
  // fresh object on every render would wipe out in-progress edits.
  const initialData = useMemo(
    () => ({
      title: recipe.title,
      ingredients: ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity ?? "",
        unit: ingredient.unit ?? "",
      })),
      steps,
      tags: initialTags,
    }),
    [recipe.title, ingredients, steps, initialTags]
  );

  const editContext = useMemo<RecipeEditContextValue>(
    () => ({ openEdit: canEdit ? () => setEditOpen(true) : null }),
    [canEdit]
  );

  function handleSaved() {
    setEditOpen(false);
    // Soft refresh: the server component re-fetches and the page shows the
    // saved recipe without a full document reload.
    router.refresh();
  }

  return (
    <RecipeEditContext.Provider value={editContext}>
      {children}

      {/* Sticky bottom action bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 25 }}
        className="fixed bottom-0 left-0 right-0 z-40 p-4"
      >
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => setCookModeOpen(true)}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-4 px-8 rounded-2xl shadow-2xl shadow-purple-500/30 hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/50 transition-all active:scale-95"
          >
            <Play className="w-5 h-5" fill="currentColor" />
            Enter Cook Mode
          </button>
        </div>
      </motion.div>

      {/* Overlays */}
      <AnimatePresence>
        {cookModeOpen && (
          <CookMode
            key="cook-mode"
            steps={steps}
            ingredients={ingredients}
            title={recipe.title}
            onClose={() => setCookModeOpen(false)}
          />
        )}

        {editOpen && (
          <EditModal
            key="edit-modal"
            recipeId={recipe.id}
            initialData={initialData}
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </RecipeEditContext.Provider>
  );
}

/**
 * Edit trigger for the recipe page button row. Renders nothing unless the
 * surrounding RecipePageClient was told the viewer can edit this recipe.
 */
export function EditRecipeButton() {
  const { openEdit } = useContext(RecipeEditContext);

  if (!openEdit) return null;

  return (
    <motion.button
      type="button"
      onClick={openEdit}
      whileTap={{ scale: 0.96 }}
      aria-label="Edit recipe"
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      <Pencil className="w-4 h-4" />
      Edit
    </motion.button>
  );
}
