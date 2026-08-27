/**
 * yt-dlp's exact wording for a given failure shifts with TikTok's site
 * changes and yt-dlp's own releases — these pin the substrings we currently
 * rely on to tell "the video itself is the problem" apart from a generic
 * fault, using real phrasing yt-dlp is known to emit.
 */
import { describe, it, expect } from "vitest";
import { classifyYtDlpFailure } from "./audio-extractor";

describe("classifyYtDlpFailure", () => {
  it("recognizes a private video", () => {
    expect(classifyYtDlpFailure("ERROR: [TikTok] 723: Private video")).toBe("private_or_deleted");
  });

  it("recognizes a deleted/unavailable video", () => {
    expect(classifyYtDlpFailure("ERROR: [TikTok] 723: Video unavailable")).toBe("private_or_deleted");
  });

  it("recognizes a removed video", () => {
    expect(classifyYtDlpFailure("This content isn't available, the video may have been removed")).toBe(
      "private_or_deleted"
    );
  });

  it("recognizes rate limiting", () => {
    expect(classifyYtDlpFailure("ERROR: Unable to download webpage: HTTP Error 429: Too Many Requests")).toBe(
      "rate_limited"
    );
  });

  it("is case-insensitive", () => {
    expect(classifyYtDlpFailure("ERROR: PRIVATE VIDEO")).toBe("private_or_deleted");
  });

  it("returns null rather than guessing for an unrecognized failure", () => {
    expect(classifyYtDlpFailure("ERROR: Connection reset by peer")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(classifyYtDlpFailure("")).toBeNull();
  });
});
