/**
 * TikTok's oEmbed endpoint collapses a private video, a deleted video, and
 * us being rate-limited into HTTP status codes rather than a distinguishing
 * body — these pin how fetchOembedMetadata reads those statuses, since it's
 * the only signal the rest of the extraction pipeline gets to explain a
 * failure to the user instead of a generic "extraction failed".
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchOembedMetadata } from "./oembed";
import { VideoUnavailableError } from "@/lib/errors";

function mockFetchResponse(status: number, ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => ({}) })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOembedMetadata", () => {
  it("returns metadata on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          title: "steak time",
          author_name: "Chef Mike",
          author_url: "https://www.tiktok.com/@chef.mike",
          thumbnail_url: "https://example.com/thumb.jpg",
          html: "<iframe></iframe>",
        }),
      })
    );

    const result = await fetchOembedMetadata("https://www.tiktok.com/@chef.mike/video/123");
    expect(result).toMatchObject({ title: "steak time", authorName: "Chef Mike" });
  });

  it("throws private_or_deleted on a 404", async () => {
    mockFetchResponse(404, false);
    await expect(fetchOembedMetadata("https://www.tiktok.com/@x/video/1")).rejects.toMatchObject({
      reason: "private_or_deleted",
    });
  });

  it("throws private_or_deleted on a 403", async () => {
    mockFetchResponse(403, false);
    await expect(fetchOembedMetadata("https://www.tiktok.com/@x/video/1")).rejects.toBeInstanceOf(
      VideoUnavailableError
    );
  });

  it("throws rate_limited on a 429", async () => {
    mockFetchResponse(429, false);
    await expect(fetchOembedMetadata("https://www.tiktok.com/@x/video/1")).rejects.toMatchObject({
      reason: "rate_limited",
    });
  });

  it("returns null (not a throw) for an unrecognized non-ok status", async () => {
    mockFetchResponse(500, false);
    await expect(fetchOembedMetadata("https://www.tiktok.com/@x/video/1")).resolves.toBeNull();
  });

  it("returns null for a network-level failure, not a throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(fetchOembedMetadata("https://www.tiktok.com/@x/video/1")).resolves.toBeNull();
  });
});
