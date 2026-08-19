-- Cost-per-extraction tracking (lib/openai-pricing.ts). All four nullable and
-- additive — a job that fails before calling OpenAI never populates them.
ALTER TABLE "extraction_jobs" ADD COLUMN "prompt_tokens" integer;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD COLUMN "completion_tokens" integer;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD COLUMN "audio_seconds" integer;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD COLUMN "cost_micros" integer;