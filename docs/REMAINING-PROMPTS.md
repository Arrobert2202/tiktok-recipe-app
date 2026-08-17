# Remaining handoff prompts — steps 0, 3, 4, 5

Four separate Claude Code sessions. **Paste them one at a time, in this order.**

Do not combine them. Each ends in a working, committed, tested state, and three of
the four contain a decision only you can make. A single mega-session would blow past
those decisions with a guess and leave you unpicking it afterwards.

| Session | Subject | Blocked by | Decision needed from you |
|---|---|---|---|
| 0 | Migration history reconciliation | — | Neon branch access |
| 3 | Recipe data model | 0 | Fork vs. overlay (session presents both) |
| 4 | Creator opt-out | — | Email provider |
| 5 | Consolidation + launch gates | 3, 4 | Stripe vs. defer monetisation |

Session 4 is independent of 0 and 3 and can be done in parallel if you prefer.

---

## Shared preamble

Every prompt below assumes this. It is repeated inside each one, so you can paste any
single section without cross-referencing.

---

# SESSION 0 — Reconcile the migration history

You are working on `tiktok-recipe-app`, a Next.js 16 (App Router) micro-SaaS that
extracts recipes from TikTok videos. Stack: Neon Postgres via Drizzle, Better-Auth
(Google OAuth), Trigger.dev v3, OpenAI `gpt-4o-mini` + `whisper-1`, Tailwind v4,
Vitest + fast-check.

**Read `docs/AUDIT-2026-08-17.md` first**, particularly the "Status log" section.
Steps 1 and 2 are complete. This session is the blocking prerequisite for step 3.

## The problem

`db/migrations/0000_sudden_shadowcat.sql` no longer describes the live database.
The schema was moved forward with ad-hoc `drizzle-kit push`, so the migration
history is missing at least: the Better-Auth tables (`session`, `account`,
`verification`), `users.credits`, `extraction_jobs.credit_refunded`,
`recipes.tips_and_tricks`, and the recently added `user_action_limits`.

The result is that `drizzle-kit generate` emits statements recreating objects that
already exist, and `drizzle-kit migrate` is unusable. There is consequently no safe
automated migration step for deployment, and step 3 — which restructures `recipes`,
`recipe_cache`, and `extraction_jobs` — cannot proceed on this footing.

## Your job

Produce a migration history that matches reality, so that `drizzle-kit generate`
once again emits clean incremental diffs.

**Work on a Neon branch, never against production.** Neon supports instant database
branching; ask me to create one and give you its connection string before you touch
anything. Confirm you are pointed at the branch — print the host you are connected
to — before running any statement that writes.

Suggested approach, but use your judgement and tell me your plan first:

1. Introspect the live schema (`drizzle-kit pull` / `introspect`) into a temporary
   location. Do not overwrite `db/schema.ts`.
2. Diff the introspected result against `db/schema.ts` and report every discrepancy
   to me before changing anything. I want to see this list — it tells us whether
   the live database has drifted in ways nobody recorded, which is a different and
   worse problem than migrations merely lagging.
3. Once the diff is understood and empty of surprises, produce a squashed baseline
   migration reflecting current reality, and mark it as already applied in Drizzle's
   `__drizzle_migrations` journal so it does not re-run against existing databases.
4. Verify: `drizzle-kit generate` against the unchanged `db/schema.ts` must now
   produce **no** pending statements. That is the success condition.
5. Document the recovery procedure in `docs/` — how the drift happened, what you
   did, and the rule going forward (generated migrations only; `push` reserved for
   local scratch databases).

## Constraints

- **Nothing destructive.** No `DROP`, no `TRUNCATE`, no column type narrowing.
  If reconciliation appears to require dropping anything, stop and ask.
- Do not modify `db/schema.ts` in this session. It is the target of truth; the
  migrations are what must be made to agree with it.
- Verify against the branch, then tell me exactly what to run against production and
  in what order. Do not run it against production yourself.
- Commit the migration files and the doc. Run `npm run typecheck` and `npm test`
  before committing; both must pass.
- Match the commenting style already in this codebase — read
  `trigger/extraction-job.ts` and `actions/account.ts` first. Comments explain
  reasoning and trade-offs, not mechanics.

Tell me your plan before executing it.

---

# SESSION 3 — Recipe data model

Same project and stack as above. **Read `docs/AUDIT-2026-08-17.md` first.** Steps 1,
2, and 0 (migration reconciliation) are complete — confirm that `drizzle-kit
generate` produces no pending statements before you start. If it does not, stop:
session 0 did not finish and this work is unsafe.

This is step 3 of the audit's plan, and it is the largest piece of engineering in it.

## The problem

Four related defects, all downstream of one design decision — that `recipes` is a
single globally shared row with no owner:

1. **Shared rows, per-user edit rights.** `recipes` has no owner column, and
   `updateRecipe` in `actions/recipe.ts` authorises anyone holding a cookbook entry.
   User A's edit silently rewrites the public `/r/[slug]` page and the copy in every
   other user's cookbook.
2. **Language-blind cache.** `recipe_cache` is keyed on `canonical_url` alone, so a
   German-language request returns the cached English recipe.
3. **Quality-blind cache.** An anonymous caption-only extraction becomes the
   permanent cached answer, so a signed-in user who would have received full audio
   fusion silently gets the thin version instead.
4. **Cross-user job dedupe returns a permanent 404.** `submitTikTokUrl` returns an
   in-flight job for the same canonical URL *regardless of owner*, and
   `/api/extraction/status/[jobId]` then rejects the poller as not-the-owner. User B
   polls forever and never receives a recipe.

## Decision I need to make — present both, recommend one, then wait

For (1) there are two shapes, and I want your analysis before you pick:

- **Copy-on-write fork** — the shared row stays canonical and immutable; the first
  time a user edits, create a user-owned copy and repoint their cookbook entry at it.
  Public share pages continue to serve the canonical row.
- **Overlay table** — the shared row stays authoritative and per-user edits live in
  a separate `recipe_overrides` table merged at read time.

Consider at minimum: storage cost, read-path complexity on the hot cookbook query,
what `/r/[slug]` should show after a fork, what happens to a fork when the canonical
row is later re-extracted, and which one step 5's consolidation will be easier on
top of. State a recommendation, then stop and wait for my answer.

## Once I have decided

- Add ownership and provenance to `recipes` — at minimum, who created it and by
  which extraction path. Note that anonymous extractions have no user, so this is
  nullable.
- Re-key `recipe_cache` on `(canonical_url, language, quality_tier)`. Quality tier
  distinguishes caption-only from audio-fusion. Client-supplied-transcript results
  must remain uncached, as step 2 established.
- Scope job dedupe to the requesting user, or introduce a subscriber model if you
  think multiple users waiting on one job is worth the complexity. Argue for whichever
  you choose.
- Migrate existing rows. **Backfill, never drop.** Existing recipes have no owner and
  no language recorded — decide what they become and tell me before running it.

## Constraints

- **This is the one session where schema changes are the point**, but every change
  must be additive-then-backfill-then-switch. No destructive migration. If you
  believe a column must be dropped, that is a separate follow-up migration after the
  code no longer reads it.
- Generated migrations only. Never `drizzle-kit push` against anything but a local
  scratch database.
- Test against a Neon branch first, exactly as in session 0.
- The existing suite mocks the DB layer entirely, so it will not catch a bad
  migration. Say so plainly in your summary rather than implying the tests prove
  correctness.
- Commit per logical change. `npm run typecheck` and `npm test` green before each.
- Do not touch the creator opt-out (session 4) or the extraction path consolidation
  (session 5).

Tell me your plan, and the fork-vs-overlay recommendation, before writing code.

---

# SESSION 4 — Make creator opt-out real

Same project and stack. **Read `docs/AUDIT-2026-08-17.md` first**, especially §3
critical finding #3.

This session is independent of sessions 0 and 3 and can run in parallel with them,
with one exception noted below.

## The problem

`actions/creator.ts` validates its inputs and returns `{ success: true }` with a
`TODO (task 13.2)`. Nothing ever writes to the `creator_opt_outs` table. Therefore:

- `isCreatorOptedOut()` in `lib/opt-out-cache.ts` queries a permanently empty table,
  so every gate depending on it is a no-op.
- `/creators` tells creators they have successfully opted out when nothing happened.
- `.kiro/specs/tiktok-recipe-app/tasks.md` marks task 13.2 complete. It is not.
- `tests/integration/opt-out.test.ts` passes against the stubs, which means it is
  currently testing nothing. It will need rewriting, not extending.

This is the application's entire ethical and legal safeguard, and it is decorative.
Of everything remaining in the audit, this is the finding I am least willing to ship
with.

## Decision I need to make — ask me before implementing

The opt-out flow requires email verification (a token sent to the address the creator
supplies, so that one person cannot opt out on another's behalf). There is no email
provider in this project at all. Present the realistic options — a transactional
provider such as Resend or Postmark, AWS SES, or a manual review queue with no email
in the first cut — with the trade-offs in setup cost, deliverability, and how much
code each implies. Then wait for my answer.

## Scope once I have decided

- Implement `submitOptOutRequest` and `reverseOptOut` properly: persist the request,
  verify by token, flip `recipes.is_public = false` for every recipe by that handle,
  delete the corresponding `recipe_cache` rows, and invalidate the opt-out cache.
- **Fix the cache invalidation properly.** `lib/opt-out-cache.ts` currently holds a
  per-process in-memory set with a 5-minute TTL, and `invalidateOptOutCache()` clears
  only the lambda instance that calls it. On serverless this means up to five minutes
  of inconsistent enforcement across instances. Replace the invalidation mechanism
  with something that works cross-instance — a version or timestamp column checked
  cheaply on read is the obvious shape. Keep the stale-cache-on-DB-failure behaviour;
  that part is deliberate and correct.
- Implement the reversal flow end to end, including restoring `is_public`.
- Rewrite `/creators` to reflect the real flow, and remove the current message that
  claims success when nothing was recorded.
- Rewrite `tests/integration/opt-out.test.ts` so it exercises real behaviour.
- Update `.kiro/specs/tiktok-recipe-app/tasks.md` to reflect the true state of task
  13.2 rather than leaving it marked complete.

## Constraints

- An additive table or column is fine. If you need to change existing tables and
  session 3 is still in flight, coordinate with me first — you would be editing the
  same migration surface.
- Secrets for whichever email provider we choose go in `.env.local.example` with a
  comment, and in your final summary as something I must set in Vercel.
- Commit per logical change; `npm run typecheck` and `npm test` green before each.
- Do not fix anything else from the audit.

Tell me your plan, and the email provider options, before writing code.

---

# SESSION 5 — Consolidation and launch gates

Same project and stack. **Read `docs/AUDIT-2026-08-17.md` first.** Sessions 0, 3, and
4 must be complete before this one starts.

This is step 5, and it has two halves. **Do the first half completely, commit it, and
report before starting the second.** If the first half runs long, stop there — the
second half is genuinely separable.

## Half one — consolidation

- **Merge the three extraction paths into one pipeline.** `submitAnonymousUrl`,
  `submitTikTokUrl`, and `submitWithDataFusion` in `actions/extraction.ts` duplicate
  validate / canonicalize / opt-out / cache / parse logic and carry three *different*
  credit policies. Collapse them into a single pipeline parameterised by caller
  context (anonymous, signed-in async, client-transcript), with one credit policy.
  The audit predicted the next several bugs would come from this divergence; it was
  right, and it is now the main obstacle to reasoning about the system.
- **Complete the client-transcript fix.** Step 2 stopped these results being made
  public or cached, but the action still accepts an arbitrary transcript string from
  the browser. Decide, with reasoning, whether to validate provenance or remove the
  capability, and tell me which before doing it.
- **Delete or implement the dead code.** `runExtractionLadder`,
  `tryNativeCaptions`, and `tryAsrTranscription` are unreferenced;
  `trigger/strategies/native-captions.ts` and `asr.ts` are `return null` placeholders.
  `hasRecipeContent` in `lib/recipe-detection.ts` and `deserialize` in
  `lib/recipe-serializer.ts` are tested but never called. My inclination is to delete
  rather than implement — this is exactly the code that makes people believe features
  exist. Argue if you disagree.
- **Fix the OG route.** `app/api/og/[slug]/route.tsx` declares `runtime = "edge"`
  while importing the Neon `Pool`, which is Node/ws-based. Resolve the mismatch and
  add cache headers; the image is fully deterministic.
- **Reconcile `.kiro/specs/tiktok-recipe-app/tasks.md` with reality.** It currently
  marks 17 of 17 tasks complete, including several that shipped as stubs. Make it a
  status document again.

## Half two — launch gates

- **Payments.** `components/paywall-modal.tsx` advertises six Pro features and has no
  Stripe, no checkout, no webhook, and no subscription state — `users.credits` is the
  only entitlement. **Ask me before starting this**; whether we monetise now or launch
  free with a waitlist is a business decision, not an engineering one.
- **Error tracking.** Observability is currently `console.log`. Add a real error
  tracker with source maps and release tagging.
- **Cost accounting.** Log OpenAI spend per extraction and per user. The unit
  economics of this product *are* the OpenAI cost, and right now they are unmeasured.
- **Error boundaries.** There is no `error.tsx` or `global-error.tsx` anywhere.
- **A README and a deployment runbook.** Neither exists. The runbook must cover: env
  vars required in Vercel, how migrations get applied on deploy, and what to do when
  yt-dlp breaks — which it will, since TikTok changes its page structure regularly and
  the whole audio path depends on it.
- **Confirm the middleware cookie fix against a real deployed HTTPS session.** Step 2
  changed `middleware.ts` to use `getSessionCookie`, but that has only been verified
  locally over HTTP. This needs eyes on production before launch.

## Constraints

- Half one is a large refactor over code with meaningful test coverage (350+ tests).
  Do not let the suite go red between commits. If a test needs changing, change it in
  the same commit as the code that made it wrong, and say why in the message.
- Deletions of dead code should be their own commits, separate from behavioural
  changes, so they are easy to review and easy to revert.
- `npm run typecheck` and `npm test` green before every commit.
- Stop and report between the two halves.

Tell me your plan for half one before writing code.
