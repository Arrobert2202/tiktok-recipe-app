/**
 * Tests for the extraction status route's dedupe fix.
 *
 * submitTikTokUrl's in-progress-job dedupe (actions/extraction.ts step 8)
 * deliberately hands an in-flight job's ID to any requester of the same
 * canonical URL, regardless of who started it — the same way a recipe_cache
 * hit already gives out a completed extraction for free. This route used to
 * 404 anyone but the original owner, turning that into a permanent dead end
 * for the second requester. These tests pin that any authenticated caller
 * can now poll status/stage/result, while the raw failure detail (exception
 * text from yt-dlp/Whisper/OpenAI/DB) stays owner-only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { GET } from "./route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function mockAuthenticated(userId: string) {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: userId, name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  } as never);
}

function mockJob(job: Record<string, unknown> | undefined) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(job ? [job] : []),
    }),
  } as never);
}

function request(jobId: string) {
  return GET(new Request(`http://localhost/api/extraction/status/${jobId}`), {
    params: Promise.resolve({ jobId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/extraction/status/[jobId]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const res = await request("job-1");

    expect(res.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 404 when the job doesn't exist", async () => {
    mockAuthenticated("user-1");
    mockJob(undefined);

    const res = await request("missing-job");

    expect(res.status).toBe(404);
  });

  it("returns full status and error detail to the job's owner", async () => {
    mockAuthenticated("owner-1");
    mockJob({
      userId: "owner-1",
      status: "failed",
      currentStage: null,
      resultRecipeId: null,
      error: {
        code: "EXTRACTION_FAILED",
        message: "yt-dlp exited with code 1: ffmpeg not found at /usr/local/bin",
        strategiesAttempted: [{ strategy: "asr", success: false, durationMs: 500 }],
      },
    });

    const res = await request("job-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.error.message).toMatch(/ffmpeg/);
    expect(body.error.strategiesAttempted).toHaveLength(1);
  });

  it("returns status/stage/result but redacts error detail for a non-owner", async () => {
    mockAuthenticated("different-user");
    mockJob({
      userId: "owner-1",
      status: "failed",
      currentStage: null,
      resultRecipeId: null,
      error: {
        code: "EXTRACTION_FAILED",
        message: "yt-dlp exited with code 1: ffmpeg not found at /usr/local/bin",
        strategiesAttempted: [{ strategy: "asr", success: false, durationMs: 500 }],
      },
    });

    const res = await request("job-1");
    const body = await res.json();

    // Not blocked entirely — this is the actual dedupe fix.
    expect(res.status).toBe(200);
    expect(body.status).toBe("failed");
    // But the raw exception text and per-strategy detail don't leak to a
    // stranger who happened to dedupe into someone else's job.
    expect(body.error).toEqual({ code: "EXTRACTION_FAILED" });
    expect(body.error.message).toBeUndefined();
    expect(body.error.strategiesAttempted).toBeUndefined();
  });

  it("lets a non-owner poll a completed job and see the result recipe", async () => {
    mockAuthenticated("different-user");
    mockJob({
      userId: "owner-1",
      status: "completed",
      currentStage: "complete",
      resultRecipeId: "recipe-42",
      error: null,
    });

    const res = await request("job-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.resultRecipeId).toBe("recipe-42");
    expect(body.error).toBeNull();
  });
});
