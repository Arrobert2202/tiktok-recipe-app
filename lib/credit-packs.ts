/**
 * Credit-pack catalog — the single source of truth for pricing, imported by
 * both the paywall UI (rendering) and actions/billing.ts (Checkout Session
 * creation). Priced against real per-extraction cost (lib/openai-pricing.ts:
 * typical ~$0.01, worst-case ~$0.06) so every pack stays profitable even at
 * worst-case usage. The Stripe webhook does NOT re-read this catalog at
 * fulfillment time — it trusts a metadata snapshot taken when the Checkout
 * Session was created, so editing this array can never misprice a session
 * a customer already has open.
 */
export interface CreditPack {
  id: string;
  credits: number;
  priceCents: number;
  label: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_10", credits: 10, priceCents: 499, label: "10 credits" },
  { id: "pack_25", credits: 25, priceCents: 999, label: "25 credits" },
  { id: "pack_60", credits: 60, priceCents: 1999, label: "60 credits" },
];
