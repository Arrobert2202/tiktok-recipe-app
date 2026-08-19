/**
 * Sanity checks on the credit-pack pricing catalog. These guard the "never
 * lose money on a paying user" requirement itself: if a future edit made a
 * larger pack cheaper per credit than a smaller one (or priced a pack at or
 * below cost), nothing else in the codebase would catch it.
 */
import { describe, it, expect } from "vitest";
import { CREDIT_PACKS } from "./credit-packs";

// Worst-case per-extraction cost estimated from lib/openai-pricing.ts's
// rates (a long transcript + long audio, priced 19 August 2026) when this
// pricing was set. Every pack must clear this with real margin — this is a
// business assumption pinned here deliberately, not derived live from the
// pricing module, so a rate change doesn't silently move the bar this test
// checks against.
const WORST_CASE_COST_PER_CREDIT_DOLLARS = 0.06;

describe("CREDIT_PACKS", () => {
  it("has at least one pack", () => {
    expect(CREDIT_PACKS.length).toBeGreaterThan(0);
  });

  it("every pack has positive integer credits and price", () => {
    for (const pack of CREDIT_PACKS) {
      expect(Number.isInteger(pack.credits)).toBe(true);
      expect(pack.credits).toBeGreaterThan(0);
      expect(Number.isInteger(pack.priceCents)).toBe(true);
      expect(pack.priceCents).toBeGreaterThan(0);
    }
  });

  it("every pack clears the worst-case per-extraction cost with margin", () => {
    for (const pack of CREDIT_PACKS) {
      const pricePerCredit = pack.priceCents / 100 / pack.credits;
      expect(pricePerCredit).toBeGreaterThan(WORST_CASE_COST_PER_CREDIT_DOLLARS);
    }
  });

  it("price-per-credit strictly decreases as pack size increases", () => {
    const sorted = [...CREDIT_PACKS].sort((a, b) => a.credits - b.credits);
    for (let i = 1; i < sorted.length; i++) {
      const prevPricePerCredit = sorted[i - 1].priceCents / sorted[i - 1].credits;
      const pricePerCredit = sorted[i].priceCents / sorted[i].credits;
      expect(pricePerCredit).toBeLessThan(prevPricePerCredit);
    }
  });

  it("has unique pack ids", () => {
    const ids = CREDIT_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
