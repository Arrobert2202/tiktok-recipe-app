"use server";

import { headers } from "next/headers";
import { tasks } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { extractionJobs, recipeCache, recipes } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { validateTikTokUrl, canonicalizeTikTokUrl, extractCreatorHandle } from "@/lib/url";
import { isCreatorOptedOut } from "@/lib/opt-out-cache";
import { fetchOembedMetadata } from "@/trigger/strategies/oembed";
import { generateSlug } from "@/lib/slug";
import { createError, RecipeParseError, TextTooLongError } from "@/lib/errors";
import type { AppError } from "@/lib/errors";
import type { RecipeOutput } from "@/lib/recipe-parser";
import type { Recipe, ExtractionStatus } from "@/lib/types";

export type SubmitResult =
  | { success: true; jobId: string; status: ExtractionStatus }
  | { success: true; recipe: Recipe }
  | { error: AppError };

export async function submitTikTokUrl(url: string, language?: string): Promise<SubmitResult> {
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

  // 7. Check recipe cache in DB (by canonical URL)
  const [cached] = await db
    .select({
      recipeId: recipeCache.recipeId,
    })
    .from(recipeCache)
    .where(eq(recipeCache.canonicalUrl, canonicalUrl))
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

  // 8. Check for existing in-progress job for same canonical URL
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
        "You've used all your free recipes. Upgrade to Pro for unlimited extractions."
      ),
    };
  }

  // 11. Fetch oEmbed metadata for creator info
  const oembedMeta = await fetchOembedMetadata(canonicalUrl);

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
    language,
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

  // 7. Cache check — free, and does not count against the rate limit
  const [cached] = await db
    .select({ recipeId: recipeCache.recipeId })
    .from(recipeCache)
    .where(eq(recipeCache.canonicalUrl, canonicalUrl))
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

  // 9. Fetch oEmbed metadata (official API, no scraping, no audio)
  const oembedMeta = await fetchOembedMetadata(canonicalUrl);
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
    parsed = await parseRecipeFromText({ captionText, language });
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
    })
    .returning({ id: recipes.id, slug: recipes.slug, title: recipes.title });

  // 12. Cache it
  await db.insert(recipeCache).values({ canonicalUrl, recipeId: recipe.id }).onConflictDoNothing();

  // 13. Consume the anonymous allowance
  await recordAnonExtraction(ipHash, canonicalUrl);

  // 14. Done
  return { success: true, recipe: { id: recipe.id, slug: recipe.slug, title: recipe.title } };
}


export type FusionSubmitResult =
  | { success: true; recipe: { id: string; slug: string; title: string } }
  | { error: AppError };

export async function submitWithDataFusion(
  url: string,
  transcript?: string,
  language?: string
): Promise<FusionSubmitResult> {
  // 1. Validate URL
  if (!validateTikTokUrl(url)) {
    return { error: createError("INVALID_URL", "Please enter a valid TikTok video URL") };
  }

  // 2. Auth check
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return { error: createError("UNAUTHORIZED", "You must be signed in") };
  }

  // 2a. Rate limit, ahead of any network call — see submitTikTokUrl for why
  // this needs to run before the credit check rather than relying on it.
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

  // 3. Canonicalize
  let canonicalUrl: string;
  try {
    canonicalUrl = await canonicalizeTikTokUrl(url);
  } catch {
    return { error: createError("CANONICALIZATION_FAILED", "Could not resolve TikTok URL") };
  }

  // 4. Creator handle + opt-out check
  const creatorHandle = extractCreatorHandle(canonicalUrl);
  if (!creatorHandle) {
    return { error: createError("CREATOR_NOT_RESOLVABLE", "Could not identify creator") };
  }

  const optedOut = await isCreatorOptedOut(creatorHandle);
  if (optedOut) {
    return { error: createError("CREATOR_OPTED_OUT", "This creator has opted out") };
  }

  // 5. Credit check (this costs money)
  const { hasCredits: userHasCredits } = await import("@/lib/credits");
  const hasCreditAvailable = await userHasCredits(session.user.id);
  if (!hasCreditAvailable) {
    return {
      error: createError(
        "INSUFFICIENT_CREDITS",
        "You've used all your free recipes. Upgrade to Pro for unlimited extractions."
      ),
    };
  }

  // 6. Fetch oEmbed caption
  const oembedMeta = await fetchOembedMetadata(canonicalUrl);
  const captionText = oembedMeta?.title;

  // 7. Parse with Data Fusion (caption + transcript)
  //
  // A parse failure is a normal outcome — some videos simply aren't recipes — so
  // it has to leave as a typed error rather than an exception. Thrown, it reaches
  // the caller as an opaque rejection: no `error.code` to branch on, nothing to
  // say beyond "something went wrong", and a server-side fault logged for what is
  // really a user-input problem.
  //
  // No credit is at stake either way — the decrement below only runs on success.
  //
  // The advice differs from the anonymous flow's THIN_CAPTION: this user already
  // supplied a transcript, so telling them to sign in for audio transcription
  // would be wrong.
  const { parseRecipeFromText } = await import("@/lib/recipe-parser");

  let parsed: RecipeOutput;
  try {
    parsed = await parseRecipeFromText({
      captionText: captionText || undefined,
      transcriptText: transcript || undefined,
      language,
    });
  } catch (error) {
    if (error instanceof TextTooLongError) {
      return {
        error: createError(
          "TEXT_TOO_LONG",
          "This video is too long to process. Try a shorter video."
        ),
      };
    }
    if (error instanceof RecipeParseError) {
      return {
        error: createError(
          "EXTRACTION_FAILED",
          "We couldn't find a recognisable recipe in this video. Try a different one."
        ),
      };
    }
    throw error;
  }

  // 8. Create recipe record.
  //
  // A client-supplied transcript is arbitrary text from the browser, fed to
  // the LLM and attributed to a real creator's name and profile. It is not
  // published as public/cached content: `isPublic: false` keeps it off the
  // public /r/[slug] share page (and out of the sitemap and OG image route,
  // which both gate on the same flag), so an attacker-controlled transcript
  // can't get indexed under someone else's name. The submitter can still see
  // and save their own result via /recipe/[id], which has no such gate.
  const slug = generateSlug();
  const isClientTranscript = !!transcript;

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
      extractionStrategy: isClientTranscript ? "data_fusion" : "oembed_caption",
      extractionDurationMs: 0,
      isPublic: !isClientTranscript,
    })
    .returning({ id: recipes.id, slug: recipes.slug, title: recipes.title });

  // 9. Cache result — skipped for a client-supplied transcript. recipe_cache is
  // global and keyed only on canonical URL, so caching this would silently
  // serve the same unverified content to every other user (including
  // submitTikTokUrl's audio-transcribed result) who later requests this URL.
  if (!isClientTranscript) {
    await db.insert(recipeCache).values({ canonicalUrl, recipeId: recipe.id }).onConflictDoNothing();
  }

  // 10. Charge 1 credit after successful extraction. Uses the same atomic
  // claim as submitTikTokUrl so the decrement itself can't race, even though
  // the check-then-act gap between step 5 and here is unchanged for now.
  const { claimCredit } = await import("@/lib/credits");
  await claimCredit(session.user.id);

  return { success: true, recipe: { id: recipe.id, slug: recipe.slug, title: recipe.title } };
}
