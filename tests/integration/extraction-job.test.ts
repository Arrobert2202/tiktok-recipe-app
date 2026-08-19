/**
 * Integration tests for the extraction job's own branching logic.
 *
 * Step 5's consolidation folded the video-upload "better accuracy" feature
 * (formerly the separate, synchronous submitWithDataFusion action) into this
 * job — a client-supplied transcript now rides along in the job payload
 * instead of the job always running its own yt-dlp + Whisper audio
 * extraction. These tests pin: the audio-extraction step is skipped when a
 * transcript is supplied, the result is saved private and uncached in that
 * case (the same rule submitWithDataFusion used to enforce for itself), and
 * failure codes are specific rather than one blanket "EXTRACTION_FAILED".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecipeParseError, TextTooLongError } from "@/lib/errors";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  task: vi.fn((config: unknown) => config),
}));

vi.mock("@/lib/recipe-parser", () => ({
  parseRecipeFromText: vi.fn(),
}));

vi.mock("@/trigger/strategies/oembed", () => ({
  fetchOembedMetadata: vi.fn(),
}));

vi.mock("@/lib/audio-extractor", () => ({
  extractAudioFromUrl: vi.fn(),
}));

vi.mock("@/lib/whisper", () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock("@/lib/credits", () => ({
  refundCredit: vi.fn().mockResolvedValue(3),
}));

import { extractionJob } from "@/trigger/extraction-job";
import { db } from "@/db";
import { recipes, recipeCache, extractionJobs } from "@/db/schema";
import { parseRecipeFromText } from "@/lib/recipe-parser";
import { fetchOembedMetadata } from "@/trigger/strategies/oembed";
import { extractAudioFromUrl } from "@/lib/audio-extractor";
import { transcribeAudio } from "@/lib/whisper";

/**
 * `extractionJob` is typed against Trigger.dev's real `Task<...>` type,
 * which has no `.run` — that only exists at runtime because `vi.mock`
 * replaces `task()` with a passthrough that returns its config unchanged
 * (see the `@trigger.dev/sdk/v3` mock above). The type system has no way to
 * know that, so this is the one place that tells it.
 */
const run = (extractionJob as unknown as { run: (payload: Record<string, unknown>) => Promise<unknown> })
  .run;

const BASE_PAYLOAD = {
  jobId: "job-1",
  canonicalUrl: "https://www.tiktok.com/@chef.mike/video/123",
  userId: "user-1",
  creatorHandle: "chef.mike",
  creatorProfileUrl: "https://www.tiktok.com/@chef.mike",
};

function mockHappyPath() {
  vi.mocked(fetchOembedMetadata).mockResolvedValue({
    title: "steak time",
    authorName: "Chef Mike",
    authorUrl: "https://www.tiktok.com/@chef.mike",
    thumbnailUrl: "https://example.com/thumb.jpg",
  });

  vi.mocked(extractAudioFromUrl).mockResolvedValue({
    buffer: Buffer.from("audio"),
    filename: "clip.m4a",
  });
  vi.mocked(transcribeAudio).mockResolvedValue({
    text: "server-transcribed audio text",
    durationSeconds: 90,
  });

  vi.mocked(parseRecipeFromText).mockResolvedValue({
    recipe: {
      title: "Seared Steak",
      ingredients: [{ name: "steak", quantity: "1", unit: "" }],
      steps: ["Sear it", "Rest it"],
      tipsAndTricks: [],
    },
    usage: { promptTokens: 150, completionTokens: 80 },
  });

  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  } as never);
}

/** Captures every db.insert(...).values(...) call, keyed by which table. */
function mockInsertCapture() {
  const calls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];

  vi.mocked(db.insert).mockImplementation(((table: unknown) => ({
    values: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      calls.push({ table, payload });
      return {
        returning: vi.fn().mockResolvedValue([{ id: "recipe-1", slug: "abc123" }]),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      };
    }),
  })) as never);

  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractionJob - clientTranscript branch", () => {
  it("skips audio extraction and uses the client transcript directly", async () => {
    mockHappyPath();
    mockInsertCapture();

    await run({ ...BASE_PAYLOAD, clientTranscript: "client-uploaded transcript" });

    expect(extractAudioFromUrl).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(parseRecipeFromText).toHaveBeenCalledWith(
      expect.objectContaining({ transcriptText: "client-uploaded transcript" })
    );
  });

  it("runs yt-dlp + Whisper as before when no client transcript is supplied", async () => {
    mockHappyPath();
    mockInsertCapture();

    await run(BASE_PAYLOAD);

    expect(extractAudioFromUrl).toHaveBeenCalledWith(BASE_PAYLOAD.canonicalUrl);
    expect(transcribeAudio).toHaveBeenCalled();
    expect(parseRecipeFromText).toHaveBeenCalledWith(
      expect.objectContaining({ transcriptText: "server-transcribed audio text" })
    );
  });

  it("saves isPublic: false and skips the cache insert when the transcript is client-supplied", async () => {
    mockHappyPath();
    const inserts = mockInsertCapture();

    await run({ ...BASE_PAYLOAD, clientTranscript: "client-uploaded transcript" });

    const recipeInsert = inserts.find((c) => c.table === recipes);
    expect(recipeInsert?.payload).toMatchObject({ isPublic: false, extractionStrategy: "data_fusion" });

    expect(inserts.find((c) => c.table === recipeCache)).toBeUndefined();
  });

  it("saves isPublic: true and writes the cache when transcription is server-side", async () => {
    mockHappyPath();
    const inserts = mockInsertCapture();

    await run(BASE_PAYLOAD);

    const recipeInsert = inserts.find((c) => c.table === recipes);
    expect(recipeInsert?.payload).toMatchObject({ isPublic: true, extractionStrategy: "data_fusion" });

    expect(inserts.find((c) => c.table === recipeCache)).toBeDefined();
  });
});

describe("extractionJob - cost tracking", () => {
  /** Captures the extraction_jobs update payloads (status changes, completion). */
  function mockJobUpdateCapture() {
    const jobUpdates: Array<Record<string, unknown>> = [];
    vi.mocked(db.update).mockImplementation(((table: unknown) => ({
      set: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        if (table === extractionJobs) jobUpdates.push(payload);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })) as never);
    return jobUpdates;
  }

  it("persists prompt/completion tokens and audio seconds on completion", async () => {
    mockHappyPath();
    mockInsertCapture();
    const jobUpdates = mockJobUpdateCapture();

    await run(BASE_PAYLOAD);

    const completion = jobUpdates.find((u) => u.status === "completed");
    expect(completion).toMatchObject({
      promptTokens: 150,
      completionTokens: 80,
      audioSeconds: 90,
    });
    expect(typeof completion?.costMicros).toBe("number");
    expect(completion?.costMicros).toBeGreaterThan(0);
  });

  it("leaves audioSeconds unset for a client-supplied transcript, since Whisper was never called for it", async () => {
    mockHappyPath();
    mockInsertCapture();
    const jobUpdates = mockJobUpdateCapture();

    await run({ ...BASE_PAYLOAD, clientTranscript: "client-uploaded transcript" });

    const completion = jobUpdates.find((u) => u.status === "completed");
    expect(completion?.audioSeconds).toBeUndefined();
    // Still has a nonzero cost from the LLM parse call itself.
    expect(completion?.costMicros).toBeGreaterThan(0);
  });
});

describe("extractionJob - failure error codes", () => {
  function mockUpdateCapture() {
    const jobUpdates: Array<Record<string, unknown>> = [];
    vi.mocked(db.update).mockImplementation(((table: unknown) => ({
      set: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        if (table === extractionJobs) jobUpdates.push(payload);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })) as never);
    return jobUpdates;
  }

  it("maps TextTooLongError to a specific code and friendly message", async () => {
    mockHappyPath();
    vi.mocked(parseRecipeFromText).mockRejectedValue(new TextTooLongError(60_000));
    const jobUpdates = mockUpdateCapture();

    await expect(run(BASE_PAYLOAD)).rejects.toThrow();

    const failureUpdate = jobUpdates.find((u) => u.status === "failed");
    expect(failureUpdate?.error).toMatchObject({
      code: "TEXT_TOO_LONG",
      message: "This video is too long to process. Try a shorter video.",
    });
  });

  it("maps RecipeParseError to EXTRACTION_FAILED with a friendly message", async () => {
    mockHappyPath();
    vi.mocked(parseRecipeFromText).mockRejectedValue(
      new RecipeParseError("no recipe found", "steak time")
    );
    const jobUpdates = mockUpdateCapture();

    await expect(run(BASE_PAYLOAD)).rejects.toThrow();

    const failureUpdate = jobUpdates.find((u) => u.status === "failed");
    expect(failureUpdate?.error).toMatchObject({
      code: "EXTRACTION_FAILED",
      message: "We couldn't find a recognisable recipe in this video. Try a different one.",
    });
  });

  it("falls back to the raw message for an unrecognized failure", async () => {
    mockHappyPath();
    vi.mocked(parseRecipeFromText).mockRejectedValue(new Error("openai connection reset"));
    const jobUpdates = mockUpdateCapture();

    await expect(run(BASE_PAYLOAD)).rejects.toThrow("openai connection reset");

    const failureUpdate = jobUpdates.find((u) => u.status === "failed");
    expect(failureUpdate?.error).toMatchObject({
      code: "EXTRACTION_FAILED",
      message: "openai connection reset",
    });
  });
});
