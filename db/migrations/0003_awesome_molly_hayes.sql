-- Step 4: makes creator opt-out real. creator_opt_outs' new pending_* columns
-- hold whichever confirmation (opt-out or reversal) is currently awaiting an
-- email click; updated_at is the marker lib/opt-out-cache.ts polls to notice
-- changes confirmed on other server instances faster than the 5-minute cache
-- TTL alone would. ip_action_limits rate-limits the (unauthenticated) creator
-- portal form, which now sends real email on submission. Purely additive —
-- new table, new nullable/defaulted columns, new indexes.
CREATE TABLE "ip_action_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"action" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_opt_outs" ADD COLUMN "pending_token" text;--> statement-breakpoint
ALTER TABLE "creator_opt_outs" ADD COLUMN "pending_action" varchar(10);--> statement-breakpoint
ALTER TABLE "creator_opt_outs" ADD COLUMN "pending_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "creator_opt_outs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_ip_action_limits_lookup" ON "ip_action_limits" USING btree ("ip_hash","action","created_at");--> statement-breakpoint
CREATE INDEX "idx_optout_pending_token" ON "creator_opt_outs" USING btree ("pending_token");--> statement-breakpoint
CREATE INDEX "idx_optout_updated_at" ON "creator_opt_outs" USING btree ("updated_at");