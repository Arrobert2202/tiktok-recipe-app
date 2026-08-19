# Step 3 — Recipe data model: ownership, cache keying, job dedupe

**Date:** 19 August 2026. Implements the plan in the audit's Step 3
(`docs/AUDIT-2026-08-17.md`). Full design rationale in the plan file used
during implementation; this doc covers what shipped and what to run.

## What changed

1. **`recipes.ownerId`** (nullable, FK to `users.id`, `ON DELETE SET NULL`).
   `updateRecipe` (`actions/recipe.ts`) now checks `recipes.ownerId ===
   session.user.id` instead of "has this recipe in their cookbook" — before
   this, any user who saved a shared recipe could rewrite it, which
   propagated to the public `/r/[slug]` page and every other saver's
   cookbook. `app/recipe/[id]/page.tsx`'s edit-button visibility follows the
   same check. Tag editing is unaffected — tags live on `cookbookEntries`,
   not `recipes`, and stay available to anyone who saved a recipe regardless
   of who owns it.

2. **`recipe_cache` keyed on `(canonical_url, language, quality_tier)`**
   instead of `canonical_url` alone. Restructured to a surrogate `id`
   primary key (matching every other table's convention) plus the two new
   columns and a composite unique index. `lib/quality-tier.ts` defines the
   tiers (caption-only vs. full/audio-fused) with an exhaustive mapping from
   `ExtractionStrategy`. The paid path (`submitTikTokUrl`) now only accepts
   a cached result at full tier or better — a thin, caption-only cache entry
   no longer silently satisfies a request that should get full audio
   fusion. `lib/languages.ts::normalizeLanguageCode` canonicalizes the
   `language` param before it's used as part of that key, so equivalent-
   but-differently-formatted values can't fragment the cache.

3. **Cross-user job dedupe** (`app/api/extraction/status/[jobId]/route.ts`):
   any authenticated user can now poll any job's status/stage/result — not
   just the job's original owner. The dedupe lookup itself
   (`actions/extraction.ts`) is unchanged and stays global, intentionally.
   Raw failure detail (exception text, per-strategy attempts) stays
   restricted to the job's actual owner; a non-owner gets `error.code` only.

## Migration

`db/migrations/0002_first_ezekiel.sql`. One correction to what
`drizzle-kit generate` produced automatically: it couldn't determine
`recipe_cache`'s existing primary-key constraint name (a known drizzle-kit
limitation for inline-declared PKs), so it left a placeholder instead of
the `DROP CONSTRAINT` needed before adding the new one. Confirmed the real
name directly against the database (`recipe_cache_pkey` — Postgres's
default naming for an unnamed inline `PRIMARY KEY`) before filling it in
and reordering it ahead of the new PK's creation.

Also includes a one-time backfill: recipes produced via the async job path
already have their submitter recorded in `extraction_jobs.user_id`, so
`owner_id` is backfilled from that join. Recipes from the anonymous or
data-fusion paths have no equivalent prior signal and stay `owner_id =
NULL` — a safe default (uneditable until claimed), not a regression.

**Verified on a Neon branch** (`migration-reconcile`, already carrying the
prior reconciliation from `docs/MIGRATION-RECONCILIATION.md`) before
touching production:
- `recipe_cache_pkey` confirmed as the real constraint name via
  `information_schema.table_constraints` before writing the migration.
- Applied via `drizzle-kit migrate` — succeeded cleanly, no manual
  bookkeeping tricks needed (unlike the earlier reconciliation, this is a
  genuinely clean migration with no ad-hoc-push drift underneath it).
- Confirmed: new unique index in place, zero duplicate `(canonical_url,
  language, quality_tier)` rows, `owner_id` FK's delete rule is `SET NULL`
  (not cascade), and `drizzle-kit generate` against the unchanged
  `db/schema.ts` reports nothing pending afterward.

## What to run against production

Production has **not** yet had the migration-history reconciliation applied
(confirmed directly — its `drizzle.__drizzle_migrations` table doesn't
exist yet). Run both, in order:

**1. The reconciliation** (if not already done — see
`docs/MIGRATION-RECONCILIATION.md` for the full explanation):

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

**2. This migration** — once the reconciliation's bookkeeping row exists,
`0002` is a genuinely clean migration with nothing to hand-split. Just run
the real tool:

```bash
npx drizzle-kit migrate
```

with `DATABASE_URL` pointed at production. It will apply
`0002_first_ezekiel.sql` in full, including the `owner_id` backfill.

After both steps, `npx drizzle-kit generate` against production should
report nothing pending — same as it did on the branch.
