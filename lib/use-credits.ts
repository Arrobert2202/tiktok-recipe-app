"use client";

import { useState, useEffect, useCallback } from "react";

const CHECKOUT_SUCCESS_MARKER = "checkout=success";
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 8;

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();

    // Stripe's webhook fulfillment is async relative to the browser's
    // redirect back from Checkout, so the balance fetched on mount can
    // still be stale. Poll briefly rather than leaving the user staring at
    // a pre-purchase number with no sign anything happened. Checked via
    // window.location directly (not useSearchParams) so this works for
    // every consumer regardless of whether it's wrapped in a Suspense
    // boundary.
    if (typeof window !== "undefined" && window.location.search.includes(CHECKOUT_SUCCESS_MARKER)) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());

      setIsSyncing(true);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts += 1;
        await fetchCredits();
        if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(interval);
          setIsSyncing(false);
        }
      }, POLL_INTERVAL_MS);

      return () => clearInterval(interval);
    }
  }, [fetchCredits]);

  return { credits, loading, isSyncing, refetch: fetchCredits };
}
