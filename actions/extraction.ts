"use server";

import { headers } from "next/headers";
import { tasks } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { extractionJobs, recipeCache, recipes } from "@/db/schema";
import { eq, and, inArray, gte, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { validateTikTokUrl, canonicalizeTikTokUrl, extractCreatorHandle } from "@/lib/url";
import { isCreatorOptedOut } from "@/lib/opt-out-cache";
import { fetchOembedMetadata } from "@/trigger/strategies/oembed";
import { generateSlug } from "@/lib/slug";
import {
  createError,
  RecipeParseError,
  TextTooLongError,
  VideoUnavailableError,
  videoUnavailableMessage,
} from "@/lib/errors";
import { normalizeLanguageCode } from "@/lib/languages";
import { getQualityTierForStrategy, QUALITY_TIER_CAPTION, QUALITY_TIER_FULL } from "@/lib/quality-tier";
import type { AppError } from "@/lib/errors";
import type { RecipeOutput } from "@/lib/recipe-parser";
import type { Recipe, ExtractionStatus } from "@/lib/types";

export type SubmitResult =
  | { success: true; jobId: string; status: ExtractionStatus }
  | { success: true; recipe: Recipe }
  | { error: AppError };

export async function submitTikTokUrl(
  url: string,
  language?: string,
  clientTranscript?: string
): Promise<SubmitResult> {
  // 1. Validate URL format
  if (!validateTikTokUrl(url)) {
    return {
      error: createError("INVALID_URL", "Please enter a valid TikTok video URL"),
    };
  }

  // 2. Check URL length (> 2048 chars)
  if (url.length > 2048) {
    return {
      error: createError("URL_TOO_LONG", "URL exceeds the maximum allowed length"),
    };
  }

  // 3. Authenticate user
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return {
      error: createError("UNAUTHORIZED", "You must be signed in to extract recipes"),
    };
  }

  // 3a. Rate limit, ahead of any network call. Cache hits and in-progress-job
  // dedupe (steps 7-8) never reach the credit charge, so without this a
  // signed-in user could hammer the canonicalize/oEmbed/DB work below for
  // free just by resubmitting.
  const { tryConsumeUserAction } = await import("@/lib/user-limit");
  const withinLimit = await tryConsumeUserAction(session.user.id, "extraction_submit");
  if (!withinLimit) {
    return {
      error: createError(
        "RATE_LIMITED",
        "Too many extraction attempts. Please wait a bit and try again."
      ),
    };
  }

  // 3b. Normalize before the value is used anywhere — both the cache lookup
  // below and the parser call inside the trigger job need the same
  // canonical value, or equivalent-but-differently-formatted language
  // strings would fragment the cache.
  const normalizedLanguage = normalizeLanguageCode(language);

  // 4. Canonicalize the URL
  let canonicalUrl: string;
  try {
    canonicalUrl = await canonicalizeTikTokUrl(url);
  } catch {
    return {
      error: createError(
        "CANONICALIZATION_FAILED",
        "Could not resolve the TikTok URL to its canonical form"
      ),
    };
  }

  // 5. Extract creator handle from canonical URL
  const creatorHandle = extractCreatorHandle(canonicalUrl);
  if (!creatorHandle) {
    return {
      error: createError(
        "CREATOR_NOT_RESOLVABLE",
        "Could not identify the video creator"
      ),
    };
  }

  // 6. Check opt-out cache
  const optedOut = await isCreatorOptedOut(creatorHandle);
  if (optedOut) {
    return {
      error: createError(
        "CREATOR_OPTED_OUT",
        "This creator has opted out of recipe extraction"
      ),
    };
  }

  // 7. Check recipe cache in DB. This is the paid, full-quality path, so a
  // cache entry only counts as a hit if it's already at full tier — a
  // caption-only entry (e.g. from an anonymous extraction of the same URL)
  // does not satisfy it, and falls through to a fresh extraction instead.
  const [cached] = await db
    .select({
      recipeId: recipeCache.recipeId,
    })
    .from(recipeCache)
    .where(
      and(
        eq(recipeCache.canonicalUrl, canonicalUrl),
        eq(recipeCache.language, normalizedLanguage),
        gte(recipeCache.qualityTier, QUALITY_TIER_FULL)
      )
    )
    .orderBy(desc(recipeCache.qualityTier))
    .limit(1);

  if (cached) {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, cached.recipeId))
      .limit(1);

    if (recipe) {
      return {
        success: true,
        recipe: {
          id: recipe.id,
          slug: recipe.slug,
          title: recipe.title,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tipsAndTricks: (recipe.tipsAndTricks as string[] | null) ?? [],
          sourceUrl: recipe.sourceUrl,
          creatorHandle: recipe.creatorHandle,
          creatorDisplayName: recipe.creatorDisplayName ?? undefined,
          creatorProfileUrl: recipe.creatorProfileUrl,
          thumbnailUrl: recipe.thumbnailUrl ?? undefined,
          extractionStrategy: recipe.extractionStrategy as Recipe["extractionStrategy"],
          extractionDurationMs: recipe.extractionDurationMs,
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt,
        },
      };
    }
  }

  // 8. Check for existing in-progress job for same canonical URL. Skipped
  // entirely when a transcript was uploaded: handing this submitter someone
  // else's already-running plain-URL job would silently discard what they
  // uploaded, with no error or indication — they specifically paid the
  // upload step for a better result, so this always creates a fresh job.
  if (!clientTranscript) {
    const IN_PROGRESS_STATUSES = ["pending", "processing"];
    const [existingJob] = await db
      .select({ id: extractionJobs.id, status: extractionJobs.status })
      .from(extractionJobs)
      .where(
        and(
          eq(extractionJobs.canonicalUrl, canonicalUrl),
          inArray(extractionJobs.status, IN_PROGRESS_STATUSES)
        )
      )
      .limit(1);

    if (existingJob) {
      return {
        success: true,
        jobId: existingJob.id,
        status: existingJob.status as ExtractionStatus,
      };
    }
  }

  // 8a. A transcript this long is guaranteed to fail the parser's combined-
  // length check (lib/recipe-parser.ts's MAX_INPUT_LENGTH, checked against
  // caption + transcript together) regardless of what the caption turns out
  // to be — catching it here, before the credit claim, avoids a pointless
  // claim -> trigger -> job -> fail -> refund round-trip for a failure
  // that's knowable synchronously. Not a duplicate of the parser's real
  // check: this is a coarse pre-check on the transcript alone.
  if (clientTranscript && clientTranscript.length > 50_000) {
    return {
      error: createError(
        "TEXT_TOO_LONG",
        "This video is too long to process. Try a shorter video."
      ),
    };
  }

  // 9-10. Claim a credit atomically (only on cache miss — this costs money).
  //
  // The charge is deliberately upfront rather than on success. Deferring it would
  // let a user fire N concurrent jobs while the balance still reads 3, since
  // nothing would deduct until the first one finished — the limit would be
  // trivially bypassable. `claimCredit` folds the check and the charge into one
  // conditional UPDATE, so two concurrent submissions can't both read a positive
  // balance and both proceed — the database picks a single winner.
  //
  // The cost of that ordering is that a job which fails has already taken the
  // credit, so the extraction job refunds it from its failure path (exactly once,
  // guarded by extractionJobs.creditRefunded).
  const { claimCredit } = await import("@/lib/credits");
  const newBalance = await claimCredit(session.user.id);
  if (newBalance === null) {
    return {
      error: createError(
        "INSUFFICIENT_CREDITS",
        "You've used all your credits. Buy more to keep extracting recipes."
      ),
    };
  }

  // 11. Fetch oEmbed metadata for creator info. Best-effort only — if this
  // fails, the job re-fetches oEmbed itself and produces the real,
  // reason-specific failure from there; this call just seeds creator
  // display info a little earlier when it's available.
  const oembedMeta = await fetchOembedMetadata(canonicalUrl).catch(() => null);

  // 12. Create new extraction job record in DB
  const [newJob] = await db
    .insert(extractionJobs)
    .values({
      userId: session.user.id,
      url,
      canonicalUrl,
      status: "pending",
      currentStage: "cache_lookup",
    })
    .returning({ id: extractionJobs.id });

  // 13. Trigger the Trigger.dev task
  await tasks.trigger("extraction-job", {
    jobId: newJob.id,
    canonicalUrl,
    userId: session.user.id,
    creatorHandle,
    creatorDisplayName: oembedMeta?.authorName,
    creatorProfileUrl: oembedMeta?.authorUrl ?? `https://www.tiktok.com/@${creatorHandle}`,
    thumbnailUrl: oembedMeta?.thumbnailUrl,
    language: normalizedLanguage,
    ...(clientTranscript ? { clientTranscript } : {}),
  });

  // 14. Return the new job ID
  return {
    success: true,
    jobId: newJob.id,
    status: "pending",
  };
}


export type AnonSubmitResult =
  | { success: true; recipe: { id: string; slug: string; title: string } }
  | { error: AppError };

/**
 * Anonymous "try one free" extraction.
 *
 * Caption-only: reads the official TikTok oEmbed description and parses that.
 * It never downloads audio and never calls a transcription service, which keeps
 * the public path cheap and legally clean. Audio transcription stays behind
 * sign-in via `submitTikTokUrl` / `submitWithDataFusion`.
 *
 * Rate limited to ANON_FREE_EXTRACTIONS per hashed IP per 24 hours. Cache hits
 * are free and do not consume the allowance, so shared links keep working.
 */
export async function submitAnonymousUrl(
  url: string,
  language?: string
): Promise<AnonSubmitResult> {
  // 1. Validate URL format
  if (!validateTikTokUrl(url)) {
    return { error: createError("INVALID_URL", "Please enter a valid TikTok video URL") };
  }

  // 2. If the visitor is actually signed in, give them the full-quality path
  //    instead of the degraded caption-only one.
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session) {
    const result = await submitTikTokUrl(url, language);
    if ("error" in result) return { error: result.error };
    if ("recipe" in result) {
      return {
        success: true,
        recipe: {
          id: result.recipe.id,
          slug: result.recipe.slug,
          title: result.recipe.title,
        },
      };
    }
    // A background job was started — the landing form cannot poll it, so hand
    // the user over to the signed-in experience.
    return {
      error: createError(
        "EXTRACTION_IN_PROGRESS",
        "Your recipe is being extracted. Head to your cookbook to follow along."
      ),
    };
  }

  // 2a. Normalize before first use (cache lookup and parser call below).
  const normalizedLanguage = normalizeLanguageCode(language);

  // 3. Resolve + hash the client IP (raw IP is never stored)
  const {
    hashIp,
    extractClientIp,
    getAnonExtractionCount,
    recordAnonExtraction,
    ANON_FREE_EXTRACTIONS,
  } = await import("@/lib/anon-limit");
  const ipHash = hashIp(extractClientIp(requestHeaders));

  // 4. Canonicalize
  let canonicalUrl: string;
  try {
    canonicalUrl = await canonicalizeTikTokUrl(url);
  } catch {
    return { error: createError("CANONICALIZATION_FAILED", "Could not resolve TikTok URL") };
  }

  // 5. Creator handle
  const creatorHandle = extractCreatorHandle(canonicalUrl);
  if (!creatorHandle) {
    return { error: createError("CREATOR_NOT_RESOLVABLE", "Could not identify the video creator") };
  }

  // 6. Opt-out check
  const optedOut = await isCreatorOptedOut(creatorHandle);
  if (optedOut) {
    return {
      error: createError("CREATOR_OPTED_OUT", "This creator has opted out of recipe extraction"),
    };
  }

  // 7. Cache check — free, and does not count against the rate limit. This
  // path only ever produces caption-tier results itself, so any cached tier
  // satisfies it (accepting `qualityTier >= QUALITY_TIER_CAPTION` rather
  // than an exact match means a richer cached result is a bonus, not a
  // requirement).
  const [cached] = await db
    .select({ recipeId: recipeCache.recipeId })
    .from(recipeCache)
    .where(
      and(
        eq(recipeCache.canonicalUrl, canonicalUrl),
        eq(recipeCache.language, normalizedLanguage),
        gte(recipeCache.qualityTier, QUALITY_TIER_CAPTION)
      )
    )
    .orderBy(desc(recipeCache.qualityTier))
    .limit(1);

  if (cached) {
    const [existing] = await db
      .select({ id: recipes.id, slug: recipes.slug, title: recipes.title })
      .from(recipes)
      .where(eq(recipes.id, cached.recipeId))
      .limit(1);

    if (existing) {
      return { success: true, recipe: existing };
    }
  }

  // 8. Rate limit check (only on cache miss — this is the part that costs money)
  const usedCount = await getAnonExtractionCount(ipHash);
  if (usedCount >= ANON_FREE_EXTRACTIONS) {
    return {
      error: createError(
        "ANON_LIMIT_REACHED",
        "You've used your free recipe. Sign in to keep going — it's free."
      ),
    };
  }

  // 9. Fetch oEmbed metadata (official API, no scraping, no audio). This is
  // the anonymous path's only fetch attempt — no async job to retry from —
  // so unlike the signed-in path's prefetch, a VideoUnavailableError here
  // has to become the actual response rather than being swallowed.
  let oembedMeta;
  try {
    oembedMeta = await fetchOembedMetadata(canonicalUrl);
  } catch (err) {
    if (err instanceof VideoUnavailableError) {
      return { error: createError(err.code, videoUnavailableMessage(err.reason)) };
    }
    oembedMeta = null;
  }
  const captionText = oembedMeta?.title?.trim();

  if (!captionText) {
    return {
      error: createError(
        "NO_CAPTION",
        "This video has no description to read. Sign in to use audio transcription instead."
      ),
    };
  }

  // 10. Parse — caption only, no transcript
  const { parseRecipeFromText } = await import("@/lib/recipe-parser");

  let parsed: RecipeOutput;
  try {
    ({ recipe: parsed } = await parseRecipeFromText({ captionText, language: normalizedLanguage }));
  } catch (error) {
    // `parseRecipeFromText` throws this above 50,000 characters, and rethrows it
    // untouched from its own catch — so it arrives here as itself rather than
    // wrapped in a RecipeParseError, and needs its own branch.
    if (error instanceof TextTooLongError) {
      return {
        error: createError(
          "TEXT_TOO_LONG",
          "This video's description is too long to process. Try a shorter video."
        ),
      };
    }
    if (error instanceof RecipeParseError) {
      return {
        error: createError(
          "THIN_CAPTION",
          "This video's description was too short for a full recipe. Sign in to use audio transcription for better results."
        ),
      };
    }
    throw error;
  }

  // 11. Insert the recipe
  const slug = generateSlug();

  const [recipe] = await db
    .insert(recipes)
    .values({
      slug,
      title: parsed.title,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      tipsAndTricks: parsed.tipsAndTricks,
      sourceUrl: canonicalUrl,
      creatorHandle,
      creatorDisplayName: oembedMeta?.authorName,
      creatorProfileUrl: oembedMeta?.authorUrl ?? `https://www.tiktok.com/@${creatorHandle}`,
      thumbnailUrl: oembedMeta?.thumbnailUrl,
      extractionStrategy: "oembed_caption",
      extractionDurationMs: 0,
      ownerId: null,
    })
    .returning({ id: recipes.id, slug: recipes.slug, title: recipes.title });

  // 12. Cache it
  await db
    .insert(recipeCache)
    .values({
      canonicalUrl,
      language: normalizedLanguage,
      qualityTier: getQualityTierForStrategy("oembed_caption"),
      recipeId: recipe.id,
    })
    .onConflictDoNothing();

  // 13. Consume the anonymous allowance
  await recordAnonExtraction(ipHash, canonicalUrl);

  // 14. Done
  return { success: true, recipe: { id: recipe.id, slug: recipe.slug, title: recipe.title } };
}


