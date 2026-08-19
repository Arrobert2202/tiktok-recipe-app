CREATE TABLE "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"stripe_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"pack_id" varchar(20) NOT NULL,
	"credits_added" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_purchases_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_credit_purchases_user" ON "credit_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_purchases_payment_intent" ON "credit_purchases" USING btree ("stripe_payment_intent_id");