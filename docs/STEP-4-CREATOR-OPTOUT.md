# Step 4 — Creator opt-out is real

**Date:** 19 August 2026. Implements the audit's Step 4
(`docs/AUDIT-2026-08-17.md`). Design and review record in the plan used
during implementation.

## What changed

`actions/creator.ts`'s `submitOptOutRequest`/`reverseOptOut` used to
validate input and return `{success: true}` without writing anything —
`isCreatorOptedOut()` queried a permanently-empty table. Now:

1. **Submitting** sends an email confirmation link (Resend). Nothing takes
   effect until that link is clicked — Requirement 10.1/10.6's "identity
   verification step," for both opting out and reversing.
2. **Confirming** (`app/creators/verify/page.tsx` → a button, not the page
   load itself, to avoid email-scanner link-prefetching silently burning
   the token → `confirmCreatorAction`) claims the token inside a
   transaction using `SELECT ... FOR UPDATE`, then cascades: opt-out sets
   `recipes.is_public = false` and deletes matching `recipe_cache` rows for
   the handle (case-insensitive, since `recipes.creatorHandle` isn't
   normalized at the source); reversal restores `is_public = true`.
3. **Two security properties added beyond the original spec's literal
   text**, both found during plan review before any code was written:
   resubmitting an opt-out request for an already-active handle is a no-op
   that never touches the stored email (closes a hijack path — without
   this, anyone could resubmit with their own address and later pass the
   reversal email-match check); and `reverseOptOut` returns the identical
   generic response whether the handle doesn't exist, isn't active, or the
   email doesn't match, so the form can't be used to enumerate opt-out
   status or fish for a creator's email.
4. `isCreatorOptedOut`'s query was fixed — it used to be `WHERE reversed_at
   IS NULL`, which also matches an unverified pending row (never active, so
   its `reversedAt` is null too), wrongly blocking extraction for a
   creator who merely had someone *submit* a request nobody confirmed. Now
   `WHERE verified_at IS NOT NULL AND reversed_at IS NULL`.
5. Cross-instance cache invalidation: `creatorOptOuts.updatedAt` is bumped
   on every confirmed change, and `lib/opt-out-cache.ts` polls it on a
   30-second interval — much shorter than the main 5-minute TTL — to
   refetch early when another server instance has changed something,
   without adding a DB round-trip to the common case or to Requirement
   11.2's 500ms extraction-gate budget.
6. The creator portal (`/creators`) sends real email now, so it's
   rate-limited by hashed IP (`lib/ip-limit.ts`, mirrors
   `lib/user-limit.ts`'s shape) — 5 requests/hour, shared across opt-out and
   reversal submissions.

## What's intentionally not addressed

Real TikTok account ownership isn't verified anywhere in this flow — only
email ownership is, which is what the spec itself calls for
("email-based or link verification"). Closing that gap needs TikTok OAuth,
out of scope here. Recipe-level handle normalization at the source
(`lib/url.ts`'s `extractCreatorHandle`) is unchanged — the cascade above
works around it with a case-insensitive match, but every recipe-creation
call site still stores whatever casing the URL happened to produce; making
that consistent everywhere is a symptom of the three-divergent-extraction-
paths problem Step 5 is meant to collapse.

## Verified before writing any application code

On a disposable Neon branch (never production), after replicating the
step-0/step-3 migration state:
- `drizzle-kit migrate` applied the new migration cleanly; `drizzle-kit
  generate` afterward reported nothing pending.
- **Functional smoke test against the real database** (not mocked): two
  concurrent `SELECT ... FOR UPDATE` claims of the same token — exactly one
  succeeded; a replay of an already-claimed token correctly matched
  nothing; the cascade correctly matched and updated a recipe stored under
  a *differently-cased* handle than the opt-out record's normalized one,
  confirming the case-insensitive match actually works, not just reads
  correctly.

Everything else (rate limiting, the hijack-prevention no-op, the
email-match/enumeration-safety behavior, the cache's marker-based
freshness check) is covered by the test suite (mocked at the DB boundary,
same convention as the rest of this codebase) — 401 tests passing,
typecheck and full production build both clean.

## What to run against production

Production still needs the Step 0 reconciliation and Step 3 migration
applied first (see `docs/MIGRATION-RECONCILIATION.md` and
`docs/STEP-3-DATA-MODEL.md`) — this step's migration builds on both. Once
those are in place, this one is a genuinely clean migration with nothing to
hand-split:

```bash
npx drizzle-kit migrate
```

with `DATABASE_URL` pointed at production. Applies
`db/migrations/0003_awesome_molly_hayes.sql` in full — one new table
(`ip_action_limits`), four new nullable/defaulted columns on
`creator_opt_outs`, two new indexes. Nothing destructive, nothing that
touches existing data.

## What you need to set up before this can actually send email

I can't do this myself — no access to your Resend account or DNS.

1. Sign up at [resend.com](https://resend.com), generate an API key, set
   `RESEND_API_KEY` in Vercel (and `.env.local` for local dev).
2. Sending from `creators@tiktokrecipe.app` (the current default, matching
   the address already referenced elsewhere in the app's copy) requires
   verifying that domain in Resend — add the DNS records it asks for. Until
   that's done, set `CREATOR_EMAIL_FROM` to Resend's shared testing domain
   (`onboarding@resend.dev`) so the flow at least works end-to-end while
   the real domain verification is pending.
3. Without `RESEND_API_KEY` set at all, submitting the `/creators` form
   still validates input and enforces the rate limit, but throws when it
   tries to actually send — the console-logged verify URL (added
   specifically for this) is what you'd use to click through and test
   locally without a real key.
