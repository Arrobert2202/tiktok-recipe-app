# Deployment runbook — what's left after the audit remediation

**Date:** 19 August 2026. Everything in code is done, tested (372 passing
tests), and committed to `main`. This file is the step-by-step for the
parts only you can do: production database changes, third-party accounts,
and env vars. Each step says exactly what to run.

Do these roughly in order — later steps depend on earlier ones (Stripe
needs the `credit_purchases` table from step 1, for example).

---

## 1. Apply the pending production migrations

Production has never actually been migrated — every migration below has
only been verified on disposable Neon branches (created and deleted during
development), never run against your real database. This is one-time,
non-destructive, additive-only work.

**Find your production connection string** in the Neon console
(console.neon.tech → your project → the `production` branch → Connection
Details), or via the CLI:

```bash
npx neonctl connection-string production --project-id damp-base-40513058
```

### Step 1a — Reconciliation (run once, manually)

Your database has drift that predates this whole remediation: some tables
(`account`, `session`, `verification`, `anonymous_extractions`,
`user_action_limits`, plus a few columns) were pushed directly with
`drizzle-kit push` at some point instead of via tracked migrations, so
Drizzle's migration history doesn't know about them. This step tells it
the truth. Full explanation in [`docs/MIGRATION-RECONCILIATION.md`](MIGRATION-RECONCILIATION.md).

Connect to production with `psql` (or the Neon console's SQL editor) and run:

```sql
CREATE TABLE "user_action_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "action" varchar(30) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "user_action_limits" ADD CONSTRAINT "user_action_limits_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_user_action_limits_lookup" ON "user_action_limits" USING btree ("user_id","action","created_at");

CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
  VALUES ('30d5ed59dc438961ed01f48d6b6a1bb3a3b56ecd26f3de4fe5234a2b28b2f665', 1787127363741);
```

If you'd rather not use `psql` directly, save the block above as
`reconcile.sql` and run:

```bash
psql "$(npx neonctl connection-string production --project-id damp-base-40513058)" -f reconcile.sql
```

### Step 1b — Apply the four tracked migrations

This applies `0002` (recipe ownership + cache keying), `0003` (creator
opt-out), `0004` (cost-per-extraction tracking), and `0005` (Stripe's
`credit_purchases` table) — all in one command, in order. From the project
root:

```bash
DATABASE_URL="$(npx neonctl connection-string production --project-id damp-base-40513058)" npx drizzle-kit migrate
```

(The `DATABASE_URL="..."` prefix overrides just this one command — it
doesn't touch your local `.env.local`, so your local dev database is
unaffected.)

### Step 1c — Confirm it worked

```bash
DATABASE_URL="$(npx neonctl connection-string production --project-id damp-base-40513058)" npx drizzle-kit generate
```

This should print **`No schema changes, nothing to migrate`**. If it
proposes any changes, stop and don't apply them blind — that means
production has drifted from what these docs assumed; come back and we'll
figure out why before touching anything further.

---

## 2. Set environment variables in Vercel

Project Settings → Environment Variables. Add these for **Production**
(and Preview, if you want preview deployments to work fully):

| Variable | Required? | What it's for |
|---|---|---|
| `BETTER_AUTH_SECRET` | **Required** | Session signing. Without it, Better-Auth falls back to an insecure default. Generate: `openssl rand -base64 32` |
| `IP_HASH_SALT` | **Required** | Anonymous rate-limiting. Without it, falls back to a salt committed in the repo. Generate: `openssl rand -base64 32` |
| `RESEND_API_KEY` | Required for creator opt-out emails to send | From [resend.com/api-keys](https://resend.com/api-keys) |
| `CREATOR_EMAIL_FROM` | Optional | Defaults to `creators@tiktokrecipe.app`, which will fail until that domain is verified in Resend (see step 3). Use `onboarding@resend.dev` in the meantime. |
| `SENTRY_DSN` | Optional but recommended | Error tracking is a silent no-op without it |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional but recommended | Same value as `SENTRY_DSN` — this one's read by the browser bundle |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Optional | Only needed for readable (non-minified) stack traces in Sentry |
| `STRIPE_SECRET_KEY` | Required for checkout to work | From your Stripe dashboard — see step 4 |
| `STRIPE_WEBHOOK_SECRET` | Required for credits to ever actually get granted | From your Stripe webhook endpoint — see step 4 |

Generate the two required secrets right now if you haven't:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # IP_HASH_SALT (run again — don't reuse the same value)
```

---

## 3. Set up Resend (creator opt-out emails)

1. Sign up at [resend.com](https://resend.com), create an API key, add it
   to Vercel as `RESEND_API_KEY` (step 2 above).
2. To send from `creators@tiktokrecipe.app`, verify that domain in Resend
   (Resend dashboard → Domains → Add Domain, then add the DNS records it
   gives you at your domain registrar). Until that's done, set
   `CREATOR_EMAIL_FROM=onboarding@resend.dev` so the flow works with
   Resend's shared testing domain.
3. Without `RESEND_API_KEY` set at all, the `/creators` form still
   validates and rate-limits, but throws when it tries to send — check
   server logs for the confirmation URL if you need to test without a key.

---

## 4. Set up Stripe (credit-pack payments — nothing exists on your account yet)

1. Sign up / log in at [dashboard.stripe.com](https://dashboard.stripe.com).
2. Grab your **test-mode** secret key first:
   `dashboard.stripe.com/test/apikeys` → copy the "Secret key" → set as
   `STRIPE_SECRET_KEY` in Vercel (Preview/test) and locally in
   `.env.local`.
3. Register a webhook endpoint:
   `dashboard.stripe.com/test/webhooks` → "Add endpoint" → URL:
   `https://<your-app-domain>/api/webhooks/stripe` → select these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
   - `charge.dispute.created`

   After creating it, click into the endpoint and copy the **Signing
   secret** (starts with `whsec_`) → set as `STRIPE_WEBHOOK_SECRET`.
4. **Test a real purchase before going live.** Deploy with the test keys
   set, open the app, trigger the paywall, buy a pack using Stripe's test
   card:

   ```
   Card number: 4242 4242 4242 4242
   Expiry: any future date
   CVC: any 3 digits
   ```

   Confirm your credit balance actually goes up after checkout completes
   (it may take a few seconds — the app polls briefly and shows "Updating
   balance…" while it waits for the webhook).

   To test the webhook locally before deploying, install the
   [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   This prints a webhook signing secret you can use as
   `STRIPE_WEBHOOK_SECRET` for local testing.

5. **Only after that test purchase works end-to-end**, switch to live
   mode: grab the live secret key
   (`dashboard.stripe.com/apikeys`, no `/test/` in the URL), register a
   **second** webhook endpoint under live mode (test and live webhooks are
   completely separate), and update `STRIPE_SECRET_KEY` /
   `STRIPE_WEBHOOK_SECRET` in Vercel's Production environment to the live
   values.

Full design/security detail on how this all works:
[`docs/STEP-5-STRIPE-BILLING.md`](STEP-5-STRIPE-BILLING.md).

---

## 5. After deploying: confirm sign-in works over real HTTPS

The Step 2 middleware fix (correct `__Secure-`-prefixed cookie name) was
verified locally, but the specific bug it fixes only shows up over real
HTTPS. After your next production deploy:

1. Sign in with a fresh browser session (or incognito).
2. Confirm you land on the app, not redirect-looped back to
   `/auth/signin`.

If that loop happens, it means the cookie-name fix needs another look —
come back and flag it rather than working around it in the browser.

---

## 6. Known gap — not yet fixed, your call on priority

**Nothing runs migrations automatically on deploy.** Every migration above
(and any future one) has to be applied by hand, the same way you just did
in step 1. Fixing this means adding a migration step to your deploy
pipeline (a `predeploy` script, a CI job, or similar) — flagging it as a
real gap rather than quietly leaving it for you to discover later.

---

## Quick reference — full command list in order

```bash
# 1. Reconciliation (paste the SQL block from section 1a into psql/Neon console)

# 2. Apply migrations 0002-0005
DATABASE_URL="$(npx neonctl connection-string production --project-id damp-base-40513058)" npx drizzle-kit migrate

# 3. Confirm clean
DATABASE_URL="$(npx neonctl connection-string production --project-id damp-base-40513058)" npx drizzle-kit generate

# 4. Generate secrets for Vercel
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # IP_HASH_SALT
```

Then: set all env vars from section 2 in Vercel → set up Resend (section
3) → set up Stripe test mode, test a purchase, then go live (section 4) →
deploy → confirm sign-in over HTTPS (section 5).
