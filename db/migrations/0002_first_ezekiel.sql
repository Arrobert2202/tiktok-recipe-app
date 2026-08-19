-- drizzle-kit couldn't determine the old primary key's name automatically
-- (it was declared inline: `canonicalUrl: text("canonical_url").primaryKey()`,
-- so Postgres auto-named the constraint using its default convention,
-- <table>_pkey). Confirmed against the actual database before applying
-- this migration anywhere — see docs/ for the verification record — rather
-- than trusted on convention alone. The drop has to happen before the new
-- primary key is added: Postgres rejects a second primary key on a table
-- that still has one, and the auto-generated statement order below has been
-- adjusted accordingly (it originally came last, uncommented, with a
-- placeholder).
ALTER TABLE "recipe_cache" DROP CONSTRAINT "recipe_cache_pkey";--> statement-breakpoint
ALTER TABLE "recipe_cache" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_cache" ADD COLUMN "language" varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_cache" ADD COLUMN "quality_tier" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_recipe_cache_lookup" ON "recipe_cache" USING btree ("canonical_url","language","quality_tier");--> statement-breakpoint

-- One-time backfill, not something new code relies on: recipes produced by
-- the async job path (submitTikTokUrl -> trigger/extraction-job.ts) already
-- have their submitter recorded in extraction_jobs.user_id. Restores edit
-- rights for those, since we can actually prove who submitted them.
-- Anonymous-path and data-fusion-path recipes have no equivalent prior
-- signal and stay owner_id = NULL — uneditable until claimed, the same safe
-- default every other recipe already has before this backfill runs.
UPDATE "recipes" r SET "owner_id" = ej."user_id"
FROM "extraction_jobs" ej
WHERE ej."result_recipe_id" = r."id" AND r."owner_id" IS NULL;
