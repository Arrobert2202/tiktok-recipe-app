"use client";

import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { saveRecipeToCookbook } from "@/actions/cookbook";

interface SaveRecipeCtaProps {
  recipeId: string;
  slug: string;
}

export function SaveRecipeCta({ recipeId, slug }: SaveRecipeCtaProps) {
  const [saved, setSaved] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSave() {
    const { data: session } = await authClient.getSession();

    if (!session) {
      window.location.href = `/auth/signin?callbackUrl=/r/${slug}`;
      return;
    }

    startTransition(async () => {
      const result = await saveRecipeToCookbook(recipeId);
      if ("success" in result) {
        setSaved(true);
      } else if (result.error.code === "ALREADY_SAVED") {
        setAlreadySaved(true);
      }
    });
  }

  if (saved) {
    return (
      <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-center">
        <p className="text-sm font-medium text-green-400">
          Recipe saved to your cookbook!
        </p>
      </div>
    );
  }

  if (alreadySaved) {
    return (
      <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-3 text-center">
        <p className="text-sm font-medium text-purple-400">
          Already in your cookbook
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={isPending}
      className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-pink-600 hover:shadow-purple-500/40 transition-all active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? "Saving..." : "Save to your cookbook"}
    </button>
  );
}
