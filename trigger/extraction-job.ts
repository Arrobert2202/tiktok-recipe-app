import { task } from "@trigger.dev/sdk/v3";
import { parseRecipeFromText } from "@/lib/recipe-parser";
import { fetchOembedMetadata } from "./strategies/oembed";
import { db } from "@/db";
import { extractionJobs, recipes, recipeCache } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateSlug } from "@/lib/slug";
import { refundCredit } from "@/lib/credits";
import { getQualityTierForStrategy } from "@/lib/quality-tier";
import { normalizeLanguageCode } from "@/lib/languages";
import { TextTooLongError, RecipeParseError } from "@/lib/errors";
import type { StrategyAttempt } from "@/lib/types";

/**
 * Refunds the upfront credit for a failed extraction, at most once per job.
 *
 * Idempotency is delegated to the database rather than to application logic. The
 * conditional UPDATE claims the refund by flipping `credit_refunded` from false
 * to true, and `.returning()` reports whether *this* statement was the one that
 * made the change. Two concurrent failure handlers both issue the same UPDATE;
 * row-level locking serialises them, the loser re-evaluates its WHERE clause
 * against the now-true value, matches nothing, and returns an empty array. Only
 * the winner proceeds to touch the balance.
 *
 * Returns true when a credit was actually returned.
 */
export async function refundCreditForFailedJob(
  jobId: string,
  userId: string
): Promise<boolean> {
  const claimed = await db
    .update(extractionJobs)
    .set({ creditRefunded: true, updatedAt: new Date() })
    .where(
      and(eq(extractionJobs.id, jobId), eq(extractionJobs.creditRefunded, false))
    )
    .returning({ id: extractionJobs.id });

  if (claimed.length === 0) {
    console.log(`[Extraction Job ${jobId}] Refund skipped, already refunded`);
    return false;
  }

  await refundCredit(userId);
  console.log(`[Extraction Job ${jobId}] Refunded 1 credit to user ${userId}`);
  return true;
}

async function updateJobStatus(
  jobId: string,
  status: string,
  currentStage?: string
) {
  await db
    .update(extractionJobs)
    .set({
      status,
      currentStage: currentStage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(extractionJobs.id, jobId));
}

export const extractionJob = task({
  id: "extraction-job",
  maxDuration: 120,
  retry: { maxAttempts: 1 },
  run: async (payload: {
    jobId: string;
    canonicalUrl: string;
    userId: string;
    creatorHandle: string;
    creatorDisplayName?: string;
    creatorProfileUrl: string;
    thumbnailUrl?: string;
    language?: string;
    // Present when the submission came with a video upload
    // (submitTikTokUrl's clientTranscript param) — the caller already ran
    // this through Whisper themselves (app/api/transcribe/route.ts), so
    // this job uses it directly instead of extracting audio itself.
    clientTranscript?: string;
  }) => {
    const { jobId, canonicalUrl } = payload;
    const attempts: StrategyAttempt[] = [];
    const isClientTranscript = !!payload.clientTranscript;

    try {
      // Step 1: Fetch oEmbed caption
      await updateJobStatus(jobId, "processing", "oembed");
      let captionText: string | undefined;
      const oembedStart = Date.now();

      try {
        const metadata = await fetchOembedMetadata(canonicalUrl);
        captionText = metadata?.title || undefined;
        attempts.push({
          strategy: "oembed_caption",
          success: !!captionText,
          durationMs: Date.now() - oembedStart,
        });
      } catch (err) {
        attempts.push({
          strategy: "oembed_caption",
          success: false,
          durationMs: Date.now() - oembedStart,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      // Step 2: Get a transcript — either the one already supplied with the
      // submission (a video upload, transcribed client-side via
      // app/api/transcribe/route.ts) or, failing that, automatic audio
      // transcription via yt-dlp + Whisper.
      await updateJobStatus(jobId, "processing", "asr");
      let transcriptText: string | undefined;
      const asrStart = Date.now();

      if (isClientTranscript) {
        transcriptText = payload.clientTranscript;
        attempts.push({ strategy: "asr", success: true, durationMs: 0 });
      } else {
        try {
          const { extractAudioFromUrl } = await import("@/lib/audio-extractor");
          const { transcribeAudio } = await import("@/lib/whisper");

          const { buffer, filename } = await extractAudioFromUrl(canonicalUrl);
          const audioBlob = new Blob([new Uint8Array(buffer)], { type: "audio/m4a" });
          transcriptText = await transcribeAudio(audioBlob, filename);

          attempts.push({
            strategy: "asr",
            success: true,
            durationMs: Date.now() - asrStart,
          });
        } catch (err) {
          // ASR is optional — continue with caption only if it fails
          attempts.push({
            strategy: "asr",
            success: false,
            durationMs: Date.now() - asrStart,
            error: err instanceof Error ? err.message : "Unknown error",
          });
          console.warn("ASR extraction failed, continuing with caption only:", err);
        }
      }

      console.log(`[Extraction Job ${jobId}] Caption: ${captionText ? captionText.slice(0, 100) : "NONE"}`);
      console.log(`[Extraction Job ${jobId}] Transcript: ${transcriptText ? transcriptText.slice(0, 100) + "..." : "NONE (ASR failed)"}`);

      // Ensure we have at least SOMETHING to parse
      if (!captionText && !transcriptText) {
        throw new Error("No text available: both caption and audio transcription failed");
      }

      // Step 3: Parse with Data Fusion LLM
      await updateJobStatus(jobId, "processing", "llm_parse");
      const parsed = await parseRecipeFromText({
        captionText,
        transcriptText,
        language: payload.language,
      });

      // Step 4: Create recipe record
      const slug = generateSlug();
      const totalDurationMs = attempts.reduce((sum, a) => sum + a.durationMs, 0);
      const strategy = transcriptText ? "data_fusion" : "oembed_caption";

      const [recipe] = await db
        .insert(recipes)
        .values({
          slug,
          title: parsed.title,
          ingredients: parsed.ingredients,
          steps: parsed.steps,
          tipsAndTricks: parsed.tipsAndTricks,
          sourceUrl: canonicalUrl,
          creatorHandle: payload.creatorHandle,
          creatorDisplayName: payload.creatorDisplayName,
          creatorProfileUrl: payload.creatorProfileUrl,
          thumbnailUrl: payload.thumbnailUrl,
          extractionStrategy: strategy,
          extractionDurationMs: totalDurationMs,
          ownerId: payload.userId,
          // A client-supplied transcript is arbitrary text from the
          // browser, fed to the LLM and attributed to a real creator's
          // name and profile. It's not published as public/cached content:
          // isPublic: false keeps it off /r/[slug] (and the sitemap and OG
          // route, which both gate on the same flag), so an attacker-
          // controlled transcript can't get indexed under someone else's
          // name. The submitter can still see and save their own result
          // via /recipe/[id], which has no such gate.
          isPublic: !isClientTranscript,
        })
        .returning();

      // Step 5: Cache the result — skipped for a client-supplied
      // transcript. recipe_cache is global, so caching this would silently
      // serve the same unverified content to every other user who later
      // requests this URL in the same language. `normalizeLanguageCode`
      // re-runs here rather than trusting `payload.language` as already-
      // normalized — submitTikTokUrl does normalize before triggering, but
      // this job is the one place that actually writes the cache row, so
      // it shouldn't depend on every future caller remembering to
      // normalize upstream.
      if (!isClientTranscript) {
        await db
          .insert(recipeCache)
          .values({
            canonicalUrl,
            language: normalizeLanguageCode(payload.language),
            qualityTier: getQualityTierForStrategy(strategy),
            recipeId: recipe.id,
          })
          .onConflictDoNothing();
      }

      // Step 6: Mark job complete
      await db
        .update(extractionJobs)
        .set({
          status: "completed",
          currentStage: "complete",
          strategiesAttempted: attempts,
          resultRecipeId: recipe.id,
          updatedAt: new Date(),
        })
        .where(eq(extractionJobs.id, jobId));

      return { recipeId: recipe.id, slug };
    } catch (error) {
      // Distinguishes the two typed failures parseRecipeFromText can throw
      // from a generic fault (network, DB, yt-dlp, etc.) — without this,
      // every failure surfaced as the same blanket "EXTRACTION_FAILED"
      // regardless of cause. home-page.tsx renders `error.message` verbatim
      // on a failed job, so this is where that copy actually comes from now.
      let code = "EXTRACTION_FAILED";
      let message = error instanceof Error ? error.message : "Unknown error";

      if (error instanceof TextTooLongError) {
        code = "TEXT_TOO_LONG";
        message = "This video is too long to process. Try a shorter video.";
      } else if (error instanceof RecipeParseError) {
        message = "We couldn't find a recognisable recipe in this video. Try a different one.";
      }

      await db
        .update(extractionJobs)
        .set({
          status: "failed",
          error: {
            code,
            message,
            strategiesAttempted: attempts,
          },
          updatedAt: new Date(),
        })
        .where(eq(extractionJobs.id, jobId));

      // The credit was taken upfront in submitTikTokUrl, so a failed extraction
      // means the user paid for nothing. Give it back.
      //
      // This runs inside its own try/catch on purpose: a refund that throws must
      // not replace the original extraction error, which is the thing actually
      // worth debugging. A lost credit is a bad day; a lost stack trace is a bad
      // week.
      try {
        await refundCreditForFailedJob(jobId, payload.userId);
      } catch (refundError) {
        console.error(
          `[Extraction Job ${jobId}] Credit refund failed (original extraction error is still being thrown):`,
          refundError
        );
      }

      throw error;
    }
  },
});
