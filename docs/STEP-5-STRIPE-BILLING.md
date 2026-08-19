# Step 5 (part 2) — Stripe credit-pack monetization

**Date:** 19 August 2026. Implements the audit's Step 5 monetization work
(`docs/AUDIT-2026-08-17.md`). Design and review record in the plan used
during implementation.

## What changed

`components/paywall-modal.tsx` used to promise "$2.99/month unlimited
extractions" with a CTA that just `alert()`ed "Stripe integration coming
soon!" — no real payment code existed anywhere. This replaces that with
real Stripe Checkout selling one-time credit packs, priced from real
per-extraction cost data (`lib/openai-pricing.ts`: typical ~$0.01,
worst-case ~$0.06/extraction) so the business can't lose money on a paying
user:

- **10 credits / $4.99**, **25 credits / $9.99**, **60 credits / $19.99**
  (`lib/credit-packs.ts`) — each 5-8x the worst-case cost floor. A flat
  "unlimited" subscription can't make that guarantee at any price; a
  motivated user can always extract past it. Credit packs can, because
  revenue-per-credit is fixed and always exceeds cost-per-credit.
- `actions/billing.ts`'s `createCheckoutSession` builds a Stripe Checkout
  Session server-side (inline `price_data`, no Stripe Dashboard
  Product/Price setup needed) and snapshots `credits`/`amountCents` into
  the session's `metadata` at creation time — the webhook trusts that
  snapshot rather than re-reading `CREDIT_PACKS` later, so an in-flight
  Checkout Session (which can sit open in a browser for hours) can never be
  mispriced by a later catalog edit.
- `app/api/webhooks/stripe/route.ts` verifies the signed raw body
  (`export const runtime = "nodejs"` explicit — signature verification
  needs Node's crypto, and this repo has sibling routes on both `edge` and
  `nodejs`), then:
  - **Fulfillment** (`checkout.session.completed` /
    `checkout.session.async_payment_succeeded`, `payment_status === "paid"`):
    inside one `db.transaction()`, `INSERT ... ON CONFLICT
    (stripe_session_id) DO NOTHING RETURNING id` into the new
    `credit_purchases` table, then grants credits only if a row actually
    came back. Stripe delivers webhooks at-least-once and both event types
    can fire for the same session — the unique constraint is what makes
    this exactly-once.
  - **Clawback** (`charge.refunded` / `charge.dispute.created`): the actual
    enforcement of "never in loss" — without this, a refunded or disputed
    payment would grant credits forever with nothing ever taking them back.
    `UPDATE credit_purchases SET refunded_at = now() WHERE
    stripe_payment_intent_id = ? AND refunded_at IS NULL RETURNING ...`
    (the one-shot guard, mirroring `extractionJobs.creditRefunded`'s
    pattern), then deducts the original `creditsAdded` from the user,
    floored at 0 with `GREATEST(...)` since the credits may already be
    spent. Reacts to `charge.dispute.created` immediately (matching
    Stripe's own behavior of provisionally withdrawing funds at creation
    time) — a dispute later won back is an intentional manual-process gap,
    not automated.
- `credit_purchases.user_id` uses `ON DELETE SET NULL` (matching
  `recipes.ownerId`'s existing precedent), not `CASCADE` like most
  user-owned tables — deleting an account shouldn't erase the only record a
  payment happened, since a refund or dispute can arrive after.
- `lib/use-credits.ts` polls briefly (~12s, 1.5s interval) after a
  `?checkout=success` redirect, since webhook fulfillment is async relative
  to the browser's redirect back — without this, a user who just paid could
  land back on the app staring at their old balance with no sign anything
  happened. `components/credit-counter.tsx` shows "Updating balance…"
  during that window.
- Copy fixes for strings that would otherwise contradict the new model the
  moment this shipped: `actions/extraction.ts`'s and
  `app/api/transcribe/route.ts`'s `INSUFFICIENT_CREDITS` messages no longer
  say "Upgrade to Pro for unlimited"; `app/terms/page.tsx`'s billing section
  now describes one-time purchases (including the refund-clawback behavior
  above) instead of monthly subscriptions, and its "fair use" section drops
  the now-nonexistent "unlimited" framing.
- While rewriting the paywall modal, dropped three feature claims that
  turned out to be false: "Export recipes as PDF" (no PDF export exists
  anywhere in the codebase), "Priority processing speed" (no priority
  mechanism exists), and "Cook Mode with wake-lock" as a paid perk (it's
  already unconditionally free — `recipe-page-client.tsx` renders it for
  any viewer).

## What's intentionally not addressed

A dispute that's later **won** doesn't automatically re-grant the clawed-
back credits — resolving that is left as a manual process (check Stripe's
dashboard, re-credit by hand if it's genuinely warranted) rather than
automated, since it's rare enough for an app this size that automating it
isn't worth the added complexity. No `stripeCustomerId` is stored on
`users` — not needed for one-time Checkout, would only matter if the
product later adds subscriptions or saved payment methods.

## Verified before writing any application code

A Plan-subagent design review (same process as Steps 4 and 5-part-1) read
the actual schema, credits/email/auth code, and paywall modal before
critiquing the design. It confirmed the core payment-security mechanics
were sound (server-only userId/packId, signed webhook verification,
unique-constraint idempotency inside a real transaction) but caught the
metadata-snapshot requirement, the missing refund/dispute handling, the
`onDelete` choice on `credit_purchases`, the `runtime = "nodejs"`
requirement, and the credit-counter staleness gap — all folded into the
design above before implementation started.

## Verified after writing it

- `npm run typecheck && npx vitest run` — 372 tests passing, including new
  coverage for `lib/credit-packs.ts` (pricing-invariant sanity checks:
  every pack clears the worst-case cost floor, price-per-credit strictly
  decreases with pack size), `addCredits` in `lib/credits.ts`,
  `actions/billing.test.ts` (auth/pack-validation/metadata-snapshot
  assertions), and `app/api/webhooks/stripe/route.test.ts` (signature
  failure, fulfillment idempotency on a replayed session, clawback
  idempotency on a replayed refund, dispute handling, unhandled event
  types).
- `npm run build` — clean production build; `/api/webhooks/stripe` compiles
  as a dynamic Node-runtime route.
- On a disposable Neon branch (`step5-stripe-billing`, deleted after),
  replayed the full reconciliation chain from `docs/MIGRATION-RECONCILIATION.md`
  (production has still never actually been migrated) through migrations
  0002-0004, then applied `db/migrations/0005_cloudy_sway.sql`:
  `drizzle-kit generate` afterward reported "No schema changes, nothing to
  migrate." Directly inspected `credit_purchases`' columns, constraints,
  and indexes on the branch to confirm they match `db/schema.ts` exactly
  (nullable `user_id` with `ON DELETE SET NULL`, unique `stripe_session_id`,
  both indexes present).
- With the dev server running locally (no Stripe keys configured):
  confirmed `/api/webhooks/stripe` returns `400 {"error":"Webhook not
  configured"}` rather than crashing or silently accepting unsigned
  requests; confirmed `/api/credits` still 401s for anonymous requests,
  unaffected; confirmed `/terms` renders the rewritten sections cleanly.
  Full end-to-end checkout (a real Checkout Session, a real webhook
  delivery) needs a Stripe test-mode account, which isn't set up in this
  environment — see below.

## What you need to set up before this can actually take payments

I can't do this myself — no access to your Stripe account.

1. Sign up at [dashboard.stripe.com](https://dashboard.stripe.com), grab
   the **test-mode** secret key first
   (`dashboard.stripe.com/test/apikeys`), set `STRIPE_SECRET_KEY` in
   `.env.local` and (later, the live key) in Vercel.
2. Register a webhook endpoint at
   `dashboard.stripe.com/test/webhooks` pointing at
   `<your-app-url>/api/webhooks/stripe`, listening for at least:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `charge.refunded`, `charge.dispute.created`. Copy the signing secret it
   gives you into `STRIPE_WEBHOOK_SECRET`.
3. Test-mode card numbers (e.g. `4242 4242 4242 4242`, any future
   expiry/CVC) let you run a full purchase end-to-end locally before
   touching real money. Use the Stripe CLI (`stripe listen --forward-to
   localhost:3000/api/webhooks/stripe`) if you want to test webhook
   delivery without deploying first.
4. Only switch `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to the live-mode
   values (and register a second, live-mode webhook endpoint — test and
   live webhooks are separate) once you've smoke-tested a purchase in test
   mode and are ready to accept real payments.
5. Without `STRIPE_SECRET_KEY` set at all, the paywall modal still renders
   and browsing works normally — clicking a pack just returns "Could not
   start checkout" instead of crashing, same fallback behavior as the
   Resend integration when its key is unset.
