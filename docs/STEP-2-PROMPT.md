# Handoff prompt — Step 2

Paste everything below the line into Claude Code, from the project root.

---

You are working on `tiktok-recipe-app`, a Next.js 16 (App Router) micro-SaaS that
extracts recipes from TikTok videos. Stack: Neon Postgres via Drizzle, Better-Auth
(Google OAuth only), Trigger.dev v3 for background extraction, OpenAI `gpt-4o-mini`
for parsing and `whisper-1` for transcription, Tailwind v4, Vitest + fast-check.

**Read `docs/AUDIT-2026-08-17.md` first.** It is the source of truth for what is
wrong with this codebase and in what order it should be fixed. Step 1 (version
control + CI) is already done — the repo has one baseline commit on `main`.

Your job is **Step 2 only: "Stop the bleeding: money, abuse, and production
lockout."** Do not start Step 3 (the recipe data-model change). Do not refactor
the three extraction paths — that is Step 5. If you find yourself editing
`db/schema.ts` for anything other than an additive index, stop and ask.

## Task A — Middleware cookie name (do this first, it may be breaking production now)

`middleware.ts` gates `/cookbook`, `/settings`, `/shopping-list`, and
`/api/extraction` by looking for a cookie literally named
`better-auth.session_token`. Better-Auth prefixes its cookies with `__Secure-`
when served over HTTPS. If that is what happens in production, every signed-in
user is redirect-looped to `/auth/signin` on those routes, while everything works
perfectly in local development.

Fix it properly rather than by string-matching both names: Better-Auth exports a
helper for exactly this. Check the installed version's API (`better-auth/cookies`)
and use it. Confirm the helper is edge-runtime safe — middleware cannot import the
full auth instance.

Note that the server components for `/settings` and `/shopping-list` already do
their own session check, so the middleware is an optimisation, not the security
boundary. Keep it that way; do not move authorisation logic into middleware.

## Task B — Credit charge is a race

`lib/credits.ts` has `hasCredits()` and `decrementCredits()` as two separate
statements, and the `UPDATE` has no `WHERE credits > 0` guard despite its docstring
claiming "Only decrements if credits > 0". Callers in `actions/extraction.ts` do
check-then-act, so concurrent submissions drive balances negative.

Replace this with a single atomic claim: one conditional `UPDATE ... SET credits =
credits - 1 WHERE id = ? AND credits > 0`, using `.returning()` to report whether
this statement was the one that won. Return something that lets the caller
distinguish "charged" from "no credits left" without a second query.

There is already a correct example of this pattern in the codebase —
`refundCreditForFailedJob` in `trigger/extraction-job.ts` claims a one-shot flag
the same way. Match its style and comment density.

Update both call sites:

- `submitTikTokUrl` — charges upfront (steps 9–10), refunded on failure. Keep that
  ordering; the comment there explains why deferring the charge makes the limit
  bypassable, and that reasoning is correct.
- `submitWithDataFusion` — currently charges on success (steps 5 and 10). Leave the
  timing as-is for now, but make the decrement itself atomic.

Do not add an upper cap in `refundCredit` — the existing comment explains why, and
it is right.

## Task C — `/api/transcribe` is an uncapped spend endpoint

`app/api/transcribe/route.ts` is auth-gated but has no credit check, no rate limit,
and no per-user quota. A signed-in user can POST 25 MB files to Whisper in a loop,
billed to us.

There is a second problem with the same endpoint: Vercel serverless functions cap
request bodies at roughly 4.5 MB. The 30 MB `serverActions.bodySizeLimit` in
`next.config.ts` does not apply to route handlers. So the 25 MB path this endpoint
advertises — and that `components/video-dropzone.tsx` offers in the UI — probably
fails in production today.

**Ask me before implementing this one.** The options are (a) gate it on credits and
lower the advertised limit to something that fits, (b) move the upload to
direct-to-storage with the worker pulling the file, or (c) drop the video-upload
feature and rely on the yt-dlp path in the Trigger job. These have very different
scopes. Present the trade-offs and wait for my answer.

## Task D — Rate limiting

Add per-user rate limiting to the authenticated server actions and route handlers.
`lib/anon-limit.ts` already does this for anonymous users via salted IP hashes and a
`anonymous_extractions` table — read it first and follow its shape rather than
inventing a second mechanism. An additive table plus index is acceptable here; a
change to an existing table is not.

## Task E — Environment variables

`BETTER_AUTH_SECRET` and `IP_HASH_SALT` are both absent from `.env.local` and both
are required in production (`lib/auth.ts` throws without the first; `lib/anon-limit.ts`
silently falls back to a constant committed to this repo without the second). Both are
now documented in `.env.local.example`. You cannot set the deployment environment
yourself — instead, verify nothing else reads an undocumented env var, and tell me
at the end exactly which variables I need to set in Vercel before deploying.

## Working constraints

- **Commit per task**, with a message that explains *why*, not just what. Match the
  commenting style already in this codebase — it explains reasoning and trade-offs,
  not mechanics. Read `trigger/extraction-job.ts` and `actions/account.ts` for the
  house style before writing any comment.
- **Run `npm run typecheck` and `npm test` before every commit.** Both must pass.
  Do not commit with a failing or skipped test.
- **Add tests for the concurrency fix in Task B.** The existing suite mocks the DB
  layer entirely (see `tests/integration/extraction.test.ts`), so a true race test
  is not possible against mocks — at minimum, assert that the atomic claim is issued
  as a single statement and that a zero-credit user is rejected.
- **Do not fix anything else you notice.** The audit lists a dozen other real bugs —
  cross-user job dedupe, language-blind caching, the dead extraction ladder, the OG
  route's edge/Node mismatch. They are all real and all deliberately scheduled later.
  If you spot something new that is not in the audit, add it to a list and tell me at
  the end rather than fixing it inline.
- **Ask before any schema change** beyond an additive table or index.

Start by reading the audit, then `middleware.ts`, `lib/auth.ts`, `lib/credits.ts`,
`actions/extraction.ts`, `lib/anon-limit.ts`, and `app/api/transcribe/route.ts`.
Tell me your plan for Tasks A, B, D, and E before you write code, and present the
Task C options for me to choose from.
