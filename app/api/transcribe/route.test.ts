/**
 * Tests for the /api/transcribe gate added alongside the credit/rate-limit fix.
 *
 * Whisper itself is mocked out — these only pin the gating order (auth →
 * credits → rate limit → size/type validation) and that a rejected request
 * never reaches transcribeAudio, since that's the billed call.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/credits", () => ({
  hasCredits: vi.fn(),
}));

vi.mock("@/lib/user-limit", () => ({
  tryConsumeUserAction: vi.fn(),
}));

vi.mock("@/lib/whisper", () => ({
  transcribeAudio: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { hasCredits } from "@/lib/credits";
import { tryConsumeUserAction } from "@/lib/user-limit";
import { transcribeAudio } from "@/lib/whisper";

function mockAuthenticated() {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  } as never);
}

function requestWithFile(file: File | null) {
  const formData = new FormData();
  if (file) formData.append("video", file);
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasCredits).mockResolvedValue(true);
  vi.mocked(tryConsumeUserAction).mockResolvedValue(true);
});

describe("POST /api/transcribe", () => {
  it("returns 401 when unauthenticated, before checking credits", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const res = await POST(requestWithFile(null));

    expect(res.status).toBe(401);
    expect(hasCredits).not.toHaveBeenCalled();
  });

  it("returns 402 and does not transcribe when the user has no credits", async () => {
    mockAuthenticated();
    vi.mocked(hasCredits).mockResolvedValue(false);

    const res = await POST(requestWithFile(null));

    expect(res.status).toBe(402);
    // Rejected before the rate limiter would even record an attempt.
    expect(tryConsumeUserAction).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("returns 429 and does not transcribe once the rate limit is hit", async () => {
    mockAuthenticated();
    vi.mocked(tryConsumeUserAction).mockResolvedValue(false);

    const res = await POST(requestWithFile(null));

    expect(res.status).toBe(429);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("rejects a file over the 4MB cap without transcribing", async () => {
    mockAuthenticated();
    const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "clip.mp4", {
      type: "video/mp4",
    });

    const res = await POST(requestWithFile(oversized));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/4MB/);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("transcribes a valid file once auth, credits, and rate limit all pass", async () => {
    mockAuthenticated();
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: "seared steak, rested ten minutes",
      durationSeconds: 42,
    });
    const file = new File([new Uint8Array(1024)], "clip.mp4", { type: "video/mp4" });

    const res = await POST(requestWithFile(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe("seared steak, rested ten minutes");
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
  });
});
