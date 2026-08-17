CREATE TABLE "cookbook_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" uuid NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" varchar(24) NOT NULL,
	"email" text NOT NULL,
	"verified_at" timestamp,
	"opted_out_at" timestamp DEFAULT now() NOT NULL,
	"reversed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_opt_outs_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "extraction_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"current_stage" varchar(20),
	"strategies_attempted" jsonb DEFAULT '[]'::jsonb,
	"result_recipe_id" uuid,
	"error" jsonb,
	"trigger_job_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_cache" (
	"canonical_url" text PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(21) NOT NULL,
	"title" varchar(200) NOT NULL,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"source_url" text NOT NULL,
	"creator_handle" varchar(24) NOT NULL,
	"creator_display_name" text,
	"creator_profile_url" text NOT NULL,
	"thumbnail_url" text,
	"extraction_strategy" varchar(20) NOT NULL,
	"extraction_duration_ms" integer NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cookbook_entries" ADD CONSTRAINT "cookbook_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookbook_entries" ADD CONSTRAINT "cookbook_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_result_recipe_id_recipes_id_fk" FOREIGN KEY ("result_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_cache" ADD CONSTRAINT "recipe_cache_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cookbook_user" ON "cookbook_entries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cookbook_user_recipe" ON "cookbook_entries" USING btree ("user_id","recipe_id");--> statement-breakpoint
CREATE INDEX "idx_optout_handle" ON "creator_opt_outs" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "idx_jobs_canonical_url" ON "extraction_jobs" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "idx_jobs_user" ON "extraction_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "extraction_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recipes_slug" ON "recipes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_recipes_source_url" ON "recipes" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "idx_recipes_creator_handle" ON "recipes" USING btree ("creator_handle");