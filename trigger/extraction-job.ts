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
  }) => {
    const { jobId, canonicalUrl } = payload;
    const attempts: StrategyAttempt[] = [];

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

      // Step 2: Attempt automatic audio transcription via yt-dlp + Whisper
      await updateJobStatus(jobId, "processing", "asr");
      let transcriptText: string | undefined;
      const asrStart = Date.now();

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
        })
        .returning();

      // Step 5: Cache the result. `normalizeLanguageCode` re-runs here
      // rather than trusting `payload.language` as already-normalized —
      // submitTikTokUrl does normalize before triggering, but this job is
      // the one place that actually writes the cache row, so it shouldn't
      // depend on every future caller remembering to normalize upstream.
      await db
        .insert(recipeCache)
        .values({
          canonicalUrl,
          language: normalizeLanguageCode(payload.language),
          qualityTier: getQualityTierForStrategy(strategy),
          recipeId: recipe.id,
        })
        .onConflictDoNothing();

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
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await db
        .update(extractionJobs)
        .set({
          status: "failed",
          error: {
            code: "EXTRACTION_FAILED",
            message: errorMessage,
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
