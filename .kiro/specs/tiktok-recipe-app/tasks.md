# Implementation Plan: TikTok Recipe App

## Overview

This plan implements a micro-SaaS that extracts structured recipes from TikTok videos using a multi-strategy extraction pipeline with LLM parsing. The implementation follows a bottom-up approach: foundational infrastructure first (project setup, DB, auth), then core extraction logic, then user-facing features (cookbook, sharing, cook mode), and finally the creator opt-out system.

## Status (reconciled 19 August 2026)

This file originally marked all 17 tasks complete. An audit
(`docs/AUDIT-2026-08-17.md`) found that wasn't accurate for three of
them — see the notes on 5.3, 5.5, and 6.1 below, corrected here to match
what the code actually does. 13.2 was a genuine stub at audit time and has
since been implemented for real (`docs/STEP-4-CREATOR-OPTOUT.md`).

This file is not being kept as a live status document going forward — a
lot has changed since it was written that it never described in the first
place (`submitAnonymousUrl` and `submitWithDataFusion`, two entire
extraction entry points beyond the `submitTikTokUrl` this file documents,
plus everything in the audit's remediation steps). Treat
`docs/AUDIT-2026-08-17.md`'s status log and the `docs/STEP-*.md` files as
the authoritative, current record; this file is a historical plan, useful
for what it originally intended, not for what shipped since.

## Tasks

- [x] 1. Project scaffolding and core configuration
  - [x] 1.1 Initialize Next.js 15 project with App Router, Tailwind CSS v4, and TypeScript configuration
    - Create `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
    - Install dependencies: `drizzle-orm`, `@neondatabase/serverless`, `better-auth`, `ai`, `@ai-sdk/openai`, `zod`, `@trigger.dev/sdk`, `@vercel/og`, `nanoid`, `fast-check`
    - Set up `.env.local.example` with required environment variable placeholders (DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, TRIGGER_SECRET_KEY, NEXT_PUBLIC_APP_URL)
    - _Requirements: 12.1_

  - [x] 1.2 Define core TypeScript types and Zod schemas
    - Create `lib/types.ts` with `Recipe`, `Ingredient`, `ExtractionJob`, `ExtractionStatus`, `ExtractionStage`, `StrategyAttempt`, `ExtractionError` interfaces
    - Create `lib/schemas.ts` with `ingredientSchema`, `recipeSchema`, `recipeEditSchema` Zod validators
    - Create `lib/errors.ts` with `AppError` interface and `createError` helper
    - _Requirements: 3.1, 3.2, 3.3, 14.1, 14.2_

  - [x] 1.3 Implement URL validation and canonicalization utilities
    - Create `lib/url.ts` with `validateTikTokUrl(url: string): boolean` supporting long-form, short-form, and mobile share URL patterns
    - Implement `canonicalizeTikTokUrl(url: string): Promise<string>` that resolves shortlinks and normalizes to `https://www.tiktok.com/@{user}/video/{id}` form
    - Enforce 2048-character URL length limit
    - _Requirements: 1.1, 1.2, 1.6, 13.1, 13.4_

  - [x] 1.4 Implement slug generation and validation utilities
    - Create `lib/slug.ts` using `nanoid` with custom alphanumeric alphabet, generating 12-character slugs
    - Create `lib/validation.ts` with `validateTag(tag: string): boolean` (1-50 chars), `validateTikTokHandle(handle: string): boolean` (alphanumeric + underscore, 1-24 chars), and `validateRecipeEdit(data: RecipeEditInput): ValidationResult`
    - _Requirements: 6.5, 7.2, 7.3, 8.1, 10.8_

- [x] 2. Database schema and migrations
  - [x] 2.1 Create Drizzle ORM schema and database connection
    - Create `db/schema.ts` with tables: `users`, `recipes`, `cookbookEntries`, `extractionJobs`, `recipeCache`, `creatorOptOuts` with all indexes as defined in the design
    - Create `db/index.ts` with Neon PostgreSQL connection using `@neondatabase/serverless`
    - Create `drizzle.config.ts` for migration configuration
    - _Requirements: 6.1, 6.2, 6.5, 13.1_

  - [x] 2.2 Generate and verify initial database migration
    - Run `drizzle-kit generate` to create the initial migration SQL
    - Verify migration includes all tables, indexes, foreign keys, and constraints from schema
    - _Requirements: 6.1, 13.1_

- [x] 3. Authentication setup
  - [x] 3.1 Configure Better-Auth with Drizzle adapter
    - Create `lib/auth.ts` with `betterAuth` configuration: email/password (min 8, max 128 chars), Google OAuth, 30-day sessions with daily refresh
    - Create `lib/auth-client.ts` with `createAuthClient` for client-side auth hooks
    - Create `app/api/auth/[...all]/route.ts` as the Better-Auth route handler
    - _Requirements: 12.1, 12.2, 12.6_

  - [x] 3.2 Implement auth middleware for protected routes
    - Create `middleware.ts` protecting `/cookbook` and `/api/extraction` routes
    - Redirect unauthenticated users to `/auth/signin` with `callbackUrl` param preserving the originally requested path
    - _Requirements: 12.5_

  - [x] 3.3 Create authentication pages
    - Create `app/auth/signin/page.tsx` with email/password form and Google OAuth button
    - Create `app/auth/signup/page.tsx` with registration form (email, password with 8-128 char validation)
    - Handle sign-in success: redirect to callback URL or `/cookbook`
    - Display generic error on auth failure without revealing email existence
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6_

- [x] 4. Checkpoint - Ensure project scaffolding compiles and auth flow works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Core extraction pipeline
  - [x] 5.1 Implement recipe content detection logic
    - Create `lib/recipe-detection.ts` with `hasRecipeContent(text: string): boolean`
    - Detect at least one ingredient quantity (numeric value or measurement word) AND at least one action verb from curated recipe verb set
    - _Requirements: 2.3_

  - [x] 5.2 Implement LLM recipe parser with Vercel AI SDK
    - Create `lib/recipe-parser.ts` with `parseRecipeFromText(text: string): Promise<RecipeOutput>`
    - Use `generateObject` from `ai` package with `openai("gpt-4o-mini")` model and `recipeSchema`
    - Enforce 50,000-character input limit, throw `TextTooLongError` if exceeded
    - Return structured error if LLM cannot identify ingredients/steps
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.3 ~~Implement recipe serialization and deserialization~~ — never used, removed
    - `lib/recipe-serializer.ts` was built (with tests) but had zero callers outside its own test suite — the actual insert/read path stores recipe content directly in Drizzle JSONB columns and never serializes to/from a JSON string. Deleted in the step 5 dead-code cleanup rather than left as unreachable code.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5 — not met by this task; if a real need for portable serialization surfaces later, revisit then._

  - [x] 5.4 Implement opt-out cache with stale-while-revalidate pattern
    - Create `lib/opt-out-cache.ts` with `isCreatorOptedOut(handle: string): Promise<boolean>`
    - Cache opt-out list in memory with 5-minute max staleness
    - Fall back to stale cache if database is unavailable on refresh
    - _Requirements: 11.4, 11.5_

  - [ ] 5.5 ~~Implement extraction strategy functions~~ — pluggable ladder never built; actual job hardcodes two strategies
    - `native-captions.ts` and `asr.ts` were always-return-null placeholders; `runExtractionLadder`'s orchestrator had zero production callers — `trigger/extraction-job.ts` hardcodes oEmbed caption fetch → yt-dlp audio extract → Whisper transcription directly, and always has. All of it (the ladder, the two stubs, and the now-orphaned `tryOembedCaption` wrapper) deleted in the step 5 cleanup; `fetchOembedMetadata` (the part that's real) kept.
    - _Requirements: 2.4 (native captions), 2.5–2.7 (ASR fallback ladder) — not met; the job's fixed two-strategy pipeline meets 2.2/2.3/2.8 directly instead._

- [x] 6. Background job infrastructure (Trigger.dev)
  - [x] 6.1 Configure Trigger.dev v3 and create extraction job task
    - Create `trigger/extraction-job.ts` with `extractionJob` task (id: "extraction-job", maxDuration: 120s, retry: maxAttempts 1)
    - Implemented flow differs from the original plan: update status → fetch oEmbed caption → yt-dlp audio extract → Whisper transcription → LLM data-fusion parse → create recipe record (with `ownerId`) → cache result (keyed on canonical URL + language + quality tier, step 3) → mark job complete. Not "run extraction ladder" — there's no pluggable strategy list, just this fixed two-source pipeline (see 5.5).
    - Handle failures: update job status to "failed" with error details and strategies attempted; refund the upfront credit exactly once (`refundCreditForFailedJob`, step 2)
    - _Requirements: 1.3, 2.6, 2.7, 2.8_

  - [x] 6.2 Implement submission Server Action with ingest gating
    - Create `actions/extraction.ts` with `submitTikTokUrl(url: string)` Server Action
    - Validate URL format → canonicalize → check opt-out → check cache → check existing job → trigger new job
    - Return cached recipe immediately on cache hit (within 500ms)
    - Return existing job ID if in-progress job exists for same canonical URL
    - Block extraction for opted-out creators with error response within 500ms
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 11.1, 11.2, 11.3, 13.2, 13.4_

  - [x] 6.3 Implement job status polling endpoint
    - Create `app/api/extraction/status/[jobId]/route.ts` returning job status, current stage, result recipe ID, or error
    - Verify user owns the job via session check
    - _Requirements: 1.4_

- [x] 7. Checkpoint - Ensure extraction pipeline compiles and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Recipe page and Cook Mode
  - [x] 8.1 Create recipe page with video embed and attribution
    - Create `app/recipe/[id]/page.tsx` with SSR data fetching
    - Render TikTok embed iframe (full width, maintain aspect ratio) with 10s load timeout and fallback link
    - Display Attribution_Block with creator @handle (linked to profile), display name if available
    - Display ingredients as checklist (session-persisted checked state) and numbered steps
    - Handle recipe not found with error message
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.1, 9.3, 9.4, 9.5_

  - [x] 8.2 Implement Cook Mode component
    - Create `components/cook-mode.tsx` with full-viewport display, 24px min body text, 48x48px min touch targets
    - Show one step at a time with forward/backward navigation and visible exit control
    - Request wake-lock on activation, release on deactivation
    - Handle unsupported wake-lock with inline notice
    - Re-acquire wake-lock on visibility change if released by OS
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 8.3 Implement URL submission UI and extraction progress
    - Create `app/page.tsx` (landing page) with URL input form
    - Create `components/extraction-progress.tsx` with status polling (every 5s), stage indicators, and completion/error states
    - Navigate to recipe page on successful extraction
    - _Requirements: 1.3, 1.4, 2.6_

- [x] 9. Personal Cookbook
  - [x] 9.1 Implement cookbook Server Actions
    - Create `actions/cookbook.ts` with `saveRecipeToCookbook`, `removeRecipeFromCookbook`, `updateRecipeTags`
    - Enforce unique user-recipe pair (return "already saved" on duplicate)
    - Validate tags (max 50 chars each, max 20 per recipe)
    - _Requirements: 6.1, 6.2, 6.5, 6.7_

  - [x] 9.2 Implement cookbook query functions
    - Create `lib/cookbook-queries.ts` with `getUserCookbook(userId, sort, page)` and `searchCookbook(userId, query)`
    - Default sort: descending by `savedAt`; options: title, date added
    - Search filters by title, ingredient name, or tag (case-insensitive), target <300ms for 500 recipes
    - _Requirements: 6.3, 6.4_

  - [x] 9.3 Create cookbook page UI
    - Create `app/cookbook/page.tsx` with recipe grid (title, thumbnail, creator attribution)
    - Add search bar, sort controls (recently saved, title, date)
    - Implement save/remove actions with optimistic UI updates and confirmation indicators
    - Prompt sign-in for unauthenticated users attempting to save
    - _Requirements: 6.1, 6.3, 6.4, 6.6_

- [x] 10. Recipe Edit Modal
  - [x] 10.1 Implement recipe edit Server Action
    - Create `actions/recipe.ts` with `updateRecipe(recipeId, data: RecipeEditInput)` Server Action
    - Validate: title non-empty ≤200 chars, ≥1 ingredient with non-empty name, ≥1 non-empty step
    - Return field-level validation errors on failure, persist valid changes and `revalidatePath`
    - _Requirements: 7.2, 7.3, 7.5, 7.6_

  - [x] 10.2 Create edit modal component
    - Create `components/edit-modal.tsx` with pre-populated fields (title, ingredients, steps, tags)
    - Support adding, removing, and reordering ingredients and steps via drag-and-drop or up/down buttons
    - Display field-level errors on validation failure without closing modal
    - Discard changes on cancel, reflect updates immediately on save success
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 11. Checkpoint - Ensure cookbook and edit features work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Public share pages and OG images
  - [x] 12.1 Create public share page with SSR
    - Create `app/r/[slug]/page.tsx` with server-side data fetching by slug
    - Display recipe with Attribution_Block (handle, display name, embedded video)
    - Include "Save to your cookbook" CTA — redirect to sign-in if unauthenticated, save if authenticated
    - Return 404 for non-existent slugs
    - Show "Creator opted out" notice for recipes where `is_public = false`
    - _Requirements: 8.1, 8.4, 8.5, 8.6, 8.7, 9.2_

  - [x] 12.2 Implement OG meta tags and dynamic OG image generation
    - Add Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) and Twitter Card meta tags to share page via Next.js `generateMetadata`
    - Create `app/api/og/[slug]/route.tsx` using `@vercel/og` `ImageResponse` — 1200×630px image with recipe title and gradient background
    - Return 404 if recipe not found, serve generic fallback on generation error
    - _Requirements: 8.2, 8.3_

- [x] 13. Creator opt-out system
  - [x] 13.1 Create creator opt-out portal page
    - Create `app/creators/page.tsx` with handle input form and verification flow
    - Validate handle format (alphanumeric + underscore, 1-24 chars)
    - Submit opt-out request → send verification email → confirm on token click
    - Display confirmation acknowledging 24-hour processing window
    - _Requirements: 10.1, 10.2, 10.8_

  - [x] 13.2 Implement opt-out Server Actions and reversal
    - Marked complete at spec-writing time but shipped as a stub — `submitOptOutRequest`/`reverseOptOut` validated input and returned `{success: true}` without touching the database; `isCreatorOptedOut` queried a permanently-empty table. Actually implemented 19 August 2026 (`docs/STEP-4-CREATOR-OPTOUT.md`).
    - `actions/creator.ts`: `submitOptOutRequest(handle, email)` and `reverseOptOut(handle, email)` send an email confirmation link (Resend) rather than taking the signature the original plan describes (a token isn't an input the caller has yet — it's generated server-side and delivered by email); a new `confirmCreatorAction(token)`, invoked by a click on `/creators/verify`, claims it and applies the effect.
    - On opt-out: insert/update `creatorOptOuts`, set `recipes.is_public = false` for the handle (case-insensitive), delete matching `recipeCache` entries, invalidate opt-out cache. On reversal: set `reversed_at`, restore `is_public = true`.
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 13.3_

- [x] 14. Checkpoint - Full feature integration check
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Property-based tests
  - [x]* 15.1 Create shared test generators (arbitraries)
    - Create `tests/properties/generators/url.gen.ts` with TikTok URL generators (valid long-form, short-form, mobile, invalid variants)
    - Create `tests/properties/generators/recipe.gen.ts` with recipe object generators (random titles 1-200 chars, ingredients 1-20 items, steps 1-30 items)
    - Create `tests/properties/generators/cookbook.gen.ts` with cookbook entry and tag generators
    - _Requirements: 1.1, 3.1, 6.5_

  - [x]* 15.2 Write property test for URL validation
    - **Property 1: TikTok URL Validation Correctness**
    - Create `tests/properties/url.property.test.ts`
    - Verify: all valid TikTok URL patterns accepted; all non-matching strings and URLs > 2048 chars rejected
    - **Validates: Requirements 1.1, 1.2, 1.6**

  - [ ]* 15.3 ~~Write property test for recipe content detection~~ — module removed
    - `lib/recipe-detection.ts` (`hasRecipeContent` and friends) had no production callers — see 5.5 — and was deleted along with this test in the step 5 cleanup.
    - **Validates: Requirements 2.3 — not met; the LLM parser decides recipe-ness on real caption/transcript text instead.**

  - [x]* 15.4 Write property test for parser output structural validity
    - **Property 3: Parser Output Structural Validity**
    - Create `tests/properties/recipe-parser.property.test.ts`
    - Verify: successful parse output has title 1-200 chars, ≥1 ingredient with name, ≥1 step, all conforming to Zod schema
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 15.5 ~~Write property test for recipe serialization round-trip~~ — module removed
    - `lib/recipe-serializer.ts` had no production callers — see 5.3 — and was deleted along with this test in the step 5 cleanup.
    - **Validates: Requirements 3.6, 14.1, 14.2, 14.3 — not met by this task.**

  - [ ]* 15.6 ~~Write property test for deserialization error handling~~ — module removed
    - Same removal as 15.5.
    - **Validates: Requirements 14.4, 14.5 — not met by this task.**

  - [x]* 15.7 Write property test for cookbook save idempotence
    - **Property 6: Cookbook Save Idempotence**
    - Create `tests/properties/cookbook.property.test.ts`
    - Verify: saving recipe N times results in exactly 1 entry; subsequent saves return "already saved"
    - **Validates: Requirements 6.2**

  - [x]* 15.8 Write property test for cookbook default sort order
    - **Property 7: Cookbook Default Sort Order**
    - Create `tests/properties/cookbook.property.test.ts` (additional test)
    - Verify: listing result is strictly descending by `savedAt` timestamp
    - **Validates: Requirements 6.3**

  - [x]* 15.9 Write property test for cookbook search relevance
    - **Property 8: Cookbook Search Relevance**
    - Create `tests/properties/cookbook.property.test.ts` (additional test)
    - Verify: every result contains query string (case-insensitive) in title, ingredient name, or tag; no non-matching recipe appears
    - **Validates: Requirements 6.4**

  - [x]* 15.10 Write property test for tag validation
    - **Property 9: Tag Validation Constraints**
    - Create `tests/properties/validation.property.test.ts`
    - Verify: strings >50 chars rejected; adding 21st tag rejected; valid tags (1-50 chars) on recipe with <20 tags accepted
    - **Validates: Requirements 6.5**

  - [x]* 15.11 Write property test for edit input validation
    - **Property 10: Edit Input Validation**
    - Create `tests/properties/validation.property.test.ts` (additional test)
    - Verify: accepts iff title non-empty ≤200 chars, ≥1 ingredient with non-empty name, ≥1 non-empty step; all others produce field-level errors
    - **Validates: Requirements 7.2, 7.3**

  - [x]* 15.12 Write property test for URL canonicalization determinism
    - **Property 11: URL Canonicalization Determinism**
    - Create `tests/properties/url.property.test.ts` (additional test)
    - Verify: all URL variants for same video ID produce identical canonical URL; canonicalize is idempotent
    - **Validates: Requirements 13.1, 13.4**

  - [x]* 15.13 Write property test for handle format validation
    - **Property 12: TikTok Handle Format Validation**
    - Create `tests/properties/validation.property.test.ts` (additional test)
    - Verify: alphanumeric + underscore, 1-24 chars accepted; all others rejected
    - **Validates: Requirements 10.8**

- [x] 16. Integration tests
  - [x]* 16.1 Write integration tests for extraction flow
    - Create `tests/integration/extraction.test.ts`
    - Test full URL → job → recipe flow with mocked TikTok API and LLM
    - Test cache hit path returns within 500ms
    - Test opt-out blocking at ingest gate
    - _Requirements: 1.1, 1.3, 2.1, 11.2, 13.2_

  - [x]* 16.2 Write integration tests for cookbook operations
    - Create `tests/integration/cookbook.test.ts`
    - Test save → retrieve → search → delete flow
    - Test duplicate save returns "already saved"
    - Test tag operations respect limits
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.7_

  - [x]* 16.3 Write integration tests for creator opt-out lifecycle
    - Create `tests/integration/opt-out.test.ts`
    - Test opt-out → extraction blocked → share page shows notice → reversal → share page restored
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The extraction strategies (5.5) depend on external TikTok API access — use mock implementations for local development and testing
- Trigger.dev requires a separate process (`npx trigger.dev@latest dev`) during local development — run this manually in a separate terminal
- Database migrations (2.2) require a running Neon PostgreSQL instance — set up via Neon dashboard before running

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 6, "tasks": ["5.5"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3"] },
    { "id": 9, "tasks": ["8.1", "8.2", "8.3", "9.1", "9.2"] },
    { "id": 10, "tasks": ["9.3", "10.1"] },
    { "id": 11, "tasks": ["10.2"] },
    { "id": 12, "tasks": ["12.1", "12.2"] },
    { "id": 13, "tasks": ["13.1", "13.2"] },
    { "id": 14, "tasks": ["15.1"] },
    { "id": 15, "tasks": ["15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "15.8", "15.9", "15.10", "15.11", "15.12", "15.13"] },
    { "id": 16, "tasks": ["16.1", "16.2", "16.3"] }
  ]
}
```
