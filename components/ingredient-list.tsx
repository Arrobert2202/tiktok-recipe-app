"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Ingredient } from "@/lib/types";

interface IngredientListProps {
  ingredients: Ingredient[];
  recipeId: string;
}

export function IngredientList({ ingredients, recipeId }: IngredientListProps) {
  const storageKey = `recipe-checked-${recipeId}`;
  const [checked, setChecked] = useState<boolean[]>(() =>
    new Array(ingredients.length).fill(false)
  );

  // Restore checked state from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === ingredients.length) {
          setChecked(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey, ingredients.length]);

  function toggle(index: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  return (
    <ul className="space-y-1">
      {ingredients.map((ingredient, index) => (
        <li key={index}>
          <button
            onClick={() => toggle(index)}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-white/5 transition-all text-left group"
            aria-pressed={checked[index]}
            aria-label={`${checked[index] ? "Uncheck" : "Check"} ${formatIngredient(ingredient)}`}
          >
            {/* Custom animated checkbox */}
            <motion.div
              className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                checked[index]
                  ? "bg-gradient-to-br from-purple-500 to-pink-500 border-transparent"
                  : "border-white/20 group-hover:border-purple-400/50"
              }`}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              {checked[index] && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                >
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </motion.div>
              )}
            </motion.div>

            {/* Ingredient text with strikethrough animation */}
            <span
              className={`text-base transition-all duration-300 ${
                checked[index]
                  ? "line-through text-white/30"
                  : "text-white/90"
              }`}
            >
              {formatIngredient(ingredient)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatIngredient(ingredient: Ingredient): string {
  const parts: string[] = [];
  if (ingredient.quantity) parts.push(ingredient.quantity);
  if (ingredient.unit) parts.push(ingredient.unit);
  parts.push(ingredient.name);
  return parts.join(" ");
}
