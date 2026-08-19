-- Reconciliation baseline: db/schema.ts moved forward via ad-hoc `drizzle-kit
-- push` for a while without anyone generating a migration, so this one file
-- captures everything that changed since 0000 in a single squash rather than
-- as separate, individually-misleading migrations.
--
-- Applying this file in full is correct for a fresh database (one that only
-- ever ran 0000): every statement below is needed to reach the current
-- db/schema.ts. On the actual production database, most of these objects
-- already exist — they were pushed, not migrated — so this file was applied
-- by hand: the objects that already existed were left alone, and only the
-- genuinely missing ones (user_action_limits and its index/FK) were actually
-- run. The migration is recorded as applied in `drizzle.__drizzle_migrations`
-- either way, because the end state is identical in both cases — that's the
-- whole point of the reconciliation. See docs/MIGRATION-RECONCILIATION.md.
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anonymous_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"canonical_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_action_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "extraction_jobs" DROP CONSTRAINT "extraction_jobs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD COLUMN "credit_refunded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "tips_and_tricks" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credits" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_action_limits" ADD CONSTRAINT "user_action_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_anon_ip_created" ON "anonymous_extractions" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_action_limits_lookup" ON "user_action_limits" USING btree ("user_id","action","created_at");--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;