"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ClipboardCopy, RotateCcw, ArrowLeft } from "lucide-react";
import {
  groupByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ShoppingCategory,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { useLanguage } from "@/lib/use-language";
import type { TranslationKey } from "@/lib/translations";

interface ShoppingListViewProps {
  items: ShoppingListItem[];
  recipeIds: string[];
  recipeCount: number;
}

const CATEGORY_LABEL_KEYS: Record<ShoppingCategory, TranslationKey> = {
  produce: "shoppingList.category.produce",
  meat_seafood: "shoppingList.category.meatSeafood",
  dairy_eggs: "shoppingList.category.dairyEggs",
  bakery: "shoppingList.category.bakery",
  pantry: "shoppingList.category.pantry",
  spices: "shoppingList.category.spices",
  frozen: "shoppingList.category.frozen",
  other: "shoppingList.category.other",
};

/** Stable per-item identity so checked state survives a reload. */
function itemKey(item: ShoppingListItem): string {
  return `${item.category}:${item.name}`;
}

export function ShoppingListView({
  items,
  recipeIds,
  recipeCount,
}: ShoppingListViewProps) {
  const { t, tCount } = useLanguage();
  const storageKey = useMemo(
    () => `shopping-list-checked-${[...recipeIds].sort().join(",")}`,
    [recipeIds]
  );

  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Restore checked state on mount so the list survives a reload mid-shop.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCheckedKeys(new Set(parsed.filter((k) => typeof k === "string")));
        }
      }
    } catch {
      // Ignore storage errors (private mode, quota, corrupt value)
    }
  }, [storageKey]);

  function persist(next: Set<string>) {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // Ignore storage errors
    }
  }

  function toggle(item: ShoppingListItem) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
      return next;
    });
  }

  function clearChecked() {
    const next = new Set<string>();
    setCheckedKeys(next);
    persist(next);
  }

  const grouped = useMemo(() => groupByCategory(items), [items]);
  const checkedCount = items.filter((item) =>
    checkedKeys.has(itemKey(item))
  ).length;

  async function copyAsText() {
    const text = buildPlainText(grouped, checkedKeys, t);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / permission denied)
    }
  }

  const visibleCategories = CATEGORY_ORDER.filter(
    (category) => grouped[category].length > 0
  );

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/cookbook"
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("shoppingList.backToCookbook")}
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{t("shoppingList.heading")}</h1>
              <p className="mt-1 text-sm text-white/50">
                {tCount("shoppingList.itemCount", items.length)} ·{" "}
                {tCount("shoppingList.recipeCountPlain", recipeCount)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70"
                aria-live="polite"
              >
                {t("shoppingList.checkedProgress", { checked: checkedCount, total: items.length })}
              </span>

              <button
                onClick={copyAsText}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {copied ? t("shoppingList.copied") : t("shoppingList.copyAsText")}
              </button>

              <button
                onClick={clearChecked}
                disabled={checkedCount === 0}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("shoppingList.clearChecked")}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={false}
              animate={{
                width: items.length
                  ? `${(checkedCount / items.length) * 100}%`
                  : "0%",
              }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
        </div>

        {/* Category sections */}
        <div className="space-y-4">
          {visibleCategories.map((category) => {
            const categoryItems = grouped[category];
            const { emoji } = CATEGORY_LABELS[category];
            const label = t(CATEGORY_LABEL_KEYS[category]);

            return (
              <section
                key={category}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
              >
                <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span aria-hidden="true">{emoji}</span>
                    {label}
                  </h2>
                  <span className="text-xs text-white/40">
                    {categoryItems.length}
                  </span>
                </header>

                <ul className="p-2">
                  {categoryItems.map((item) => {
                    const key = itemKey(item);
                    const isChecked = checkedKeys.has(key);

                    return (
                      <li key={key}>
                        <button
                          onClick={() => toggle(item)}
                          aria-pressed={isChecked}
                          aria-label={t(
                            isChecked ? "shoppingList.uncheckItemAria" : "shoppingList.checkItemAria",
                            { name: item.name }
                          )}
                          className="group flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-left transition-all hover:bg-white/5"
                        >
                          {/* Animated checkbox */}
                          <motion.div
                            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                              isChecked
                                ? "border-transparent bg-gradient-to-br from-purple-500 to-pink-500"
                                : "border-white/20 group-hover:border-purple-400/50"
                            }`}
                            animate={{ scale: 1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 15,
                            }}
                          >
                            {isChecked && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 20,
                                }}
                              >
                                <Check
                                  className="h-3.5 w-3.5 text-white"
                                  strokeWidth={3}
                                />
                              </motion.div>
                            )}
                          </motion.div>

                          {/* Name + contributing recipes */}
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-base transition-all duration-300 ${
                                isChecked
                                  ? "text-white/30 line-through"
                                  : "text-white/90"
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.recipeTitles.length > 1 && (
                              <span
                                className={`mt-0.5 block truncate text-xs transition-colors ${
                                  isChecked ? "text-white/20" : "text-white/40"
                                }`}
                              >
                                {item.recipeTitles.join(" · ")}
                              </span>
                            )}
                          </span>

                          {/* Merged quantity pill */}
                          {item.merged && (
                            <span
                              className={`flex-shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium transition-colors ${
                                isChecked ? "text-white/25" : "text-white/60"
                              }`}
                            >
                              {item.merged}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function buildPlainText(
  grouped: Record<string, ShoppingListItem[]>,
  checkedKeys: Set<string>,
  t: (key: TranslationKey) => string
): string {
  const lines: string[] = [t("shoppingList.heading"), ""];

  for (const category of CATEGORY_ORDER) {
    const categoryItems = grouped[category];
    if (!categoryItems || categoryItems.length === 0) continue;

    const { emoji } = CATEGORY_LABELS[category];
    const label = t(CATEGORY_LABEL_KEYS[category]);
    lines.push(`${emoji} ${label}`);

    for (const item of categoryItems) {
      const box = checkedKeys.has(itemKey(item)) ? "[x]" : "[ ]";
      const quantity = item.merged ? ` — ${item.merged}` : "";
      lines.push(`- ${box} ${item.name}${quantity}`);
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
