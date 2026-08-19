# Migration History Reconciliation — 19 August 2026

## What happened

`db/migrations/0000_sudden_shadowcat.sql` only ever created six tables
(`cookbook_entries`, `creator_opt_outs`, `extraction_jobs`, `recipe_cache`,
`recipes`, `users`). Everything else that's live today — the Better-Auth
tables (`account`, `session`, `verification`), `anonymous_extractions`,
`users.credits`, `extraction_jobs.credit_refunded`,
`recipes.tips_and_tricks` — reached the database via `drizzle-kit push`
at some point, not via a generated migration. `push` syncs the live schema
directly from `db/schema.ts`; it never touches `db/migrations/`, so none of
that history was ever recorded.

The practical effect: `drizzle-kit generate` no longer computed a clean
diff (it proposed recreating objects that already existed), and
`drizzle-kit migrate` was unusable — running it blind would have tried to
`CREATE TABLE` things Postgres would reject as already existing.

One additional, more recent gap surfaced during this reconciliation:
`user_action_limits` (added to `db/schema.ts` in the migration-history
session, for per-user rate limiting) had never actually been pushed to the
live database at all. It existed only in code. This is the one place where
`push` *should* have been run and wasn't, rather than a case of `push`
running instead of a migration.

## Why this had to be verified, not assumed

Given that `push` had already been used at least once to move the schema
forward silently, there was no way to know from `db/schema.ts` and the
migration files alone whether the live database matched `db/schema.ts`
exactly, or had drifted further in some third, undocumented direction. The
two could easily have disagreed with each other in ways nobody had reason
to notice, since nothing had ever diffed them against each other.

So the check came first: a Neon branch (`migration-reconcile`, branched
from `production`) was introspected read-only, and the result was diffed
against `db/schema.ts` using Drizzle's own diffing engine (by treating the
introspected snapshot as a throwaway "already applied" baseline and running
`drizzle-kit generate` against the real, unmodified `db/schema.ts`). That
diff came back with exactly one real difference: the missing
`user_action_limits` table. Every other column, type, default, and foreign
key already matched. The diff also proposed `DROP INDEX` / `CREATE INDEX`
pairs, name-for-name identical, for the 9 pre-existing indexes — checked by
hand against `db/schema.ts` and confirmed to be a Drizzle-kit artifact
(independently-generated snapshots assign indexes different internal
bookkeeping IDs, so the differ treats an unchanged index as "deleted, then
recreated identically"), not a real difference. Those were excluded from
the migration that was actually written.

## What was done

1. `db/migrations/0001_wild_cloak.sql` was generated for real (via
   `drizzle-kit generate` against the actual, unmodified migration history —
   not the throwaway introspected one used for diffing above). It captures
   the full delta from 0000 to the current `db/schema.ts`, which is what
   makes it a correct migration for a database that only ever ran 0000 —
   a fresh environment, or a new local database, applies this file in full
   and ends up in the same place production is in today.

2. On production, most of that file describes objects that already exist.
   Rather than running the whole file (which would fail on the objects
   `push` had already created) or skipping it in the tracking table (which
   would leave `user_action_limits` never actually created), the two were
   separated by hand:
   - The genuinely missing piece — `CREATE TABLE user_action_limits`, its
     `user_id → users.id` foreign key, and `idx_user_action_limits_lookup`
     — was executed for real, in a transaction, on the Neon branch.
   - The migration was then recorded as applied in
     `drizzle.__drizzle_migrations` (schema, table, and hash-tracking
     convention exactly as `drizzle-orm`'s own Postgres migrator creates
     and reads — see `node_modules/drizzle-orm/pg-core/dialect.js`), using
     the sha256 of the final committed file and the journal's `when`
     timestamp for `0001_wild_cloak`. Marking it applied is accurate either
     way: the resulting schema state is identical whether a given statement
     in the file actually ran or was already true going in.
   - `migrate()` only ever compares the *single most recent* bookkeeping
     row's `created_at` against each journal entry's timestamp — it doesn't
     look up rows per-migration. One row, timestamped at `0001`'s journal
     entry, is therefore sufficient to make it skip both `0000` and `0001`
     on every future run. No separate `0000` bookkeeping row was needed.

3. Verified on the branch: `drizzle-kit migrate` completed with zero
   statements executed (already applied), and `drizzle-kit generate` against
   the unchanged `db/schema.ts` reported `No schema changes, nothing to
   migrate` — the stated success condition. Also confirmed directly that
   `user_action_limits` has the expected columns, foreign key, and index.

## What to run against production

Two things, in order, against the **production** database (not the branch —
delete the branch once you're satisfied, it was only ever scratch space):

1. Run the real DDL for the one object that's actually missing:

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
   ```

2. Seed the bookkeeping row so `drizzle-kit migrate` treats history as
   caught up:

   ```sql
   CREATE SCHEMA IF NOT EXISTS "drizzle";
   CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
     id SERIAL PRIMARY KEY,
     hash text NOT NULL,
     created_at bigint
   );
   INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
     VALUES ('30d5ed59dc438961ed01f48d6b6a1bb3a3b56ecd26f3de4fe5234a2b28b2f665', 1787127363741);
   ```

   The hash must match `db/migrations/0001_wild_cloak.sql` exactly as
   committed — if that file changes for any reason before this runs,
   recompute with `sha256sum db/migrations/0001_wild_cloak.sql` (or
   equivalent) rather than reusing this value.

After that, `npx drizzle-kit generate` against production should report no
pending changes, the same as it did against the branch.

## The rule going forward

**`drizzle-kit push` is for local, throwaway databases only.** Any change to
`db/schema.ts` destined for a real environment goes through
`drizzle-kit generate`, gets committed, and is applied with
`drizzle-kit migrate` (or an equivalent tracked apply step in CI/CD — there
still isn't one; that's the "Migrations on deploy" gap from the original
audit, unresolved). `push` bypasses the migration history entirely, which
is exactly how this drift happened in the first place, twice.
