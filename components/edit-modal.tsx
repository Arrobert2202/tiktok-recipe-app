"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { updateRecipe } from "@/actions/recipe";
import type { Ingredient } from "@/lib/types";

interface EditModalProps {
  recipeId: string;
  initialData: {
    title: string;
    ingredients: { name: string; quantity: string; unit: string }[];
    steps: string[];
    tags: string[];
  };
  isOpen: boolean;
  onClose: () => void;
  onSaved: (recipe: {
    id: string;
    title: string;
    ingredients: Ingredient[];
    steps: string[];
  }) => void;
}

export function EditModal({
  recipeId,
  initialData,
  isOpen,
  onClose,
  onSaved,
}: EditModalProps) {
  const [title, setTitle] = useState(initialData.title);
  const [ingredients, setIngredients] = useState(initialData.ingredients);
  const [steps, setSteps] = useState(initialData.steps);
  const [tags, setTags] = useState(initialData.tags);
  const [newTag, setNewTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset form state when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setTitle(initialData.title);
      setIngredients(initialData.ingredients);
      setSteps(initialData.steps);
      setTags(initialData.tags);
      setNewTag("");
      setErrors({});
      setSaveError(null);
    }
  }, [isOpen, initialData]);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // --- Ingredient operations ---
  function addIngredient() {
    setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateIngredient(
    index: number,
    field: "name" | "quantity" | "unit",
    value: string
  ) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    );
  }

  function moveIngredient(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ingredients.length) return;
    setIngredients((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  }

  // --- Step operations ---
  function addStep() {
    setSteps((prev) => [...prev, ""]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  }

  // --- Tag operations ---
  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.length >= 20) {
      setErrors((prev) => ({
        ...prev,
        tags: "A recipe may have at most 20 tags",
      }));
      return;
    }
    if (trimmed.length > 50) {
      setErrors((prev) => ({
        ...prev,
        tags: "Tag must be at most 50 characters",
      }));
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setNewTag("");
    setErrors((prev) => {
      const { tags: _, ...rest } = prev;
      return rest;
    });
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  // --- Save ---
  function handleSave() {
    setErrors({});
    setSaveError(null);

    startTransition(async () => {
      const result = await updateRecipe(recipeId, {
        title,
        ingredients,
        steps,
        tags,
      });

      if ("error" in result) {
        if (result.error.code === "VALIDATION_ERROR" && result.error.details) {
          setErrors(result.error.details);
        } else {
          setSaveError(result.error.message);
        }
        return;
      }

      onSaved(result.recipe);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Edit recipe"
    >
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit Recipe</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Save error banner */}
          {saveError && (
            <div
              className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700"
              role="alert"
            >
              {saveError}
            </div>
          )}

          {/* Title field */}
          <div>
            <label
              htmlFor="edit-title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
                errors.title
                  ? "border-red-400 focus:border-red-500"
                  : "border-gray-300 focus:border-purple-500"
              }`}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "edit-title-error" : undefined}
            />
            {errors.title && (
              <p
                id="edit-title-error"
                className="mt-1 text-xs text-red-600"
                role="alert"
              >
                {errors.title}
              </p>
            )}
          </div>

          {/* Ingredients editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ingredients
            </label>
            {errors.ingredients && (
              <p className="mb-2 text-xs text-red-600" role="alert">
                {errors.ingredients}
              </p>
            )}
            <div className="space-y-2">
              {ingredients.map((ing, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveIngredient(index, "up")}
                      disabled={index === 0}
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={`Move ingredient ${index + 1} up`}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveIngredient(index, "down")}
                      disabled={index === ingredients.length - 1}
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={`Move ingredient ${index + 1} down`}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={ing.quantity ?? ""}
                    onChange={(e) =>
                      updateIngredient(index, "quantity", e.target.value)
                    }
                    placeholder="Qty"
                    className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    aria-label={`Ingredient ${index + 1} quantity`}
                  />
                  <input
                    type="text"
                    value={ing.unit ?? ""}
                    onChange={(e) =>
                      updateIngredient(index, "unit", e.target.value)
                    }
                    placeholder="Unit"
                    className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    aria-label={`Ingredient ${index + 1} unit`}
                  />
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) =>
                      updateIngredient(index, "name", e.target.value)
                    }
                    placeholder="Ingredient name (required)"
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    aria-label={`Ingredient ${index + 1} name`}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="rounded p-1 text-gray-400 hover:text-red-500"
                    aria-label={`Remove ingredient ${index + 1}`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addIngredient}
              className="mt-2 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-purple-400 hover:text-purple-600"
            >
              + Add ingredient
            </button>
          </div>

          {/* Steps editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Steps
            </label>
            {errors.steps && (
              <p className="mb-2 text-xs text-red-600" role="alert">
                {errors.steps}
              </p>
            )}
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(index, "up")}
                      disabled={index === 0}
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={`Move step ${index + 1} up`}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(index, "down")}
                      disabled={index === steps.length - 1}
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={`Move step ${index + 1} down`}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  <span className="mt-1.5 flex-shrink-0 text-sm font-medium text-gray-500">
                    {index + 1}.
                  </span>
                  <textarea
                    value={step}
                    onChange={(e) => updateStep(index, e.target.value)}
                    placeholder="Describe this step..."
                    rows={2}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm resize-y focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    aria-label={`Step ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="rounded p-1 text-gray-400 hover:text-red-500"
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStep}
              className="mt-2 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-purple-400 hover:text-purple-600"
            >
              + Add step
            </button>
          </div>

          {/* Tags editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            {errors.tags && (
              <p className="mb-2 text-xs text-red-600" role="alert">
                {errors.tags}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="rounded-full p-0.5 hover:bg-purple-200"
                    aria-label={`Remove tag "${tag}"`}
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag..."
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                aria-label="New tag"
              />
              <button
                type="button"
                onClick={addTag}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
