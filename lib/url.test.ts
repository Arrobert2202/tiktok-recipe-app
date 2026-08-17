import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateTikTokUrl,
  extractCreatorHandle,
  canonicalizeTikTokUrl,
} from "./url";

describe("validateTikTokUrl", () => {
  describe("long-form URLs", () => {
    it("accepts https://www.tiktok.com/@user/video/1234567890", () => {
      expect(
        validateTikTokUrl("https://www.tiktok.com/@user/video/1234567890")
      ).toBe(true);
    });

    it("accepts without https://", () => {
      expect(
        validateTikTokUrl("www.tiktok.com/@user/video/1234567890")
      ).toBe(true);
    });

    it("accepts without www", () => {
      expect(
        validateTikTokUrl("https://tiktok.com/@user/video/1234567890")
      ).toBe(true);
    });

    it("accepts http:// prefix", () => {
      expect(
        validateTikTokUrl("http://www.tiktok.com/@user/video/1234567890")
      ).toBe(true);
    });

    it("accepts with trailing query params", () => {
      expect(
        validateTikTokUrl(
          "https://www.tiktok.com/@user/video/1234567890?is_from_webapp=1&sender_device=pc"
        )
      ).toBe(true);
    });

    it("accepts usernames with dots", () => {
      expect(
        validateTikTokUrl("https://www.tiktok.com/@user.name/video/9876543210")
      ).toBe(true);
    });

    it("accepts usernames with underscores", () => {
      expect(
        validateTikTokUrl("https://www.tiktok.com/@user_name/video/9876543210")
      ).toBe(true);
    });
  });

  describe("short-form URLs", () => {
    it("accepts https://vm.tiktok.com/ABC123", () => {
      expect(validateTikTokUrl("https://vm.tiktok.com/ABC123")).toBe(true);
    });

    it("accepts without https://", () => {
      expect(validateTikTokUrl("vm.tiktok.com/ABC123")).toBe(true);
    });

    it("accepts http:// prefix", () => {
      expect(validateTikTokUrl("http://vm.tiktok.com/ZMeXyz456")).toBe(true);
    });
  });

  describe("mobile share URLs", () => {
    it("accepts https://www.tiktok.com/t/ABC123", () => {
      expect(validateTikTokUrl("https://www.tiktok.com/t/ABC123")).toBe(true);
    });

    it("accepts without www", () => {
      expect(validateTikTokUrl("https://tiktok.com/t/ABC123")).toBe(true);
    });

    it("accepts without https://", () => {
      expect(validateTikTokUrl("tiktok.com/t/ABC123")).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("rejects empty string", () => {
      expect(validateTikTokUrl("")).toBe(false);
    });

    it("rejects random string", () => {
      expect(validateTikTokUrl("not a url at all")).toBe(false);
    });

    it("rejects non-TikTok URLs", () => {
      expect(validateTikTokUrl("https://www.youtube.com/watch?v=abc123")).toBe(
        false
      );
    });

    it("rejects TikTok profile URLs (not video)", () => {
      expect(validateTikTokUrl("https://www.tiktok.com/@user")).toBe(false);
    });

    it("rejects URLs exceeding 2048 characters", () => {
      const longUrl =
        "https://www.tiktok.com/@user/video/1234567890?" + "x".repeat(2048);
      expect(validateTikTokUrl(longUrl)).toBe(false);
    });

    it("rejects URL of exactly 2049 characters (over limit)", () => {
      // Build a URL that's exactly 2049 chars
      const base = "https://www.tiktok.com/@user/video/1234567890?q=";
      const padding = "a".repeat(2049 - base.length);
      const url = base + padding;
      expect(url.length).toBe(2049);
      expect(validateTikTokUrl(url)).toBe(false);
    });

    it("accepts URL of exactly 2048 characters (at limit)", () => {
      const base = "https://www.tiktok.com/@user/video/1234567890?q=";
      const padding = "a".repeat(2048 - base.length);
      const url = base + padding;
      expect(url.length).toBe(2048);
      expect(validateTikTokUrl(url)).toBe(true);
    });
  });
});

describe("extractCreatorHandle", () => {
  it("extracts handle from long-form URL", () => {
    expect(
      extractCreatorHandle("https://www.tiktok.com/@chef_mike/video/1234567890")
    ).toBe("chef_mike");
  });

  it("extracts handle with dots", () => {
    expect(
      extractCreatorHandle("https://tiktok.com/@user.name/video/9876543210")
    ).toBe("user.name");
  });

  it("returns null for short-form URLs", () => {
    expect(extractCreatorHandle("https://vm.tiktok.com/ABC123")).toBe(null);
  });

  it("returns null for mobile share URLs", () => {
    expect(extractCreatorHandle("https://tiktok.com/t/ABC123")).toBe(null);
  });

  it("returns null for non-TikTok URLs", () => {
    expect(extractCreatorHandle("https://youtube.com/watch?v=abc")).toBe(null);
  });
});

describe("canonicalizeTikTokUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("long-form URLs (no network needed)", () => {
    it("normalizes a long-form URL to canonical form", async () => {
      const result = await canonicalizeTikTokUrl(
        "https://www.tiktok.com/@user/video/1234567890"
      );
      expect(result).toBe("https://www.tiktok.com/@user/video/1234567890");
    });

    it("strips query parameters from long-form URLs", async () => {
      const result = await canonicalizeTikTokUrl(
        "https://www.tiktok.com/@user/video/1234567890?is_from_webapp=1&sender_device=pc"
      );
      expect(result).toBe("https://www.tiktok.com/@user/video/1234567890");
    });

    it("adds https://www prefix to bare long-form URL", async () => {
      const result = await canonicalizeTikTokUrl(
        "tiktok.com/@user/video/1234567890"
      );
      expect(result).toBe("https://www.tiktok.com/@user/video/1234567890");
    });

    it("is idempotent — canonical URL stays unchanged", async () => {
      const canonical = "https://www.tiktok.com/@user/video/1234567890";
      const result = await canonicalizeTikTokUrl(canonical);
      expect(result).toBe(canonical);
    });
  });

  describe("short-form and mobile URLs (follows redirects)", () => {
    it("resolves short-form URL via redirects", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({
          status: 301,
          headers: new Headers({
            location:
              "https://www.tiktok.com/@chef_mike/video/7123456789012345678",
          }),
        }).mockResolvedValueOnce({
          status: 200,
          headers: new Headers(),
        })
      );

      const result = await canonicalizeTikTokUrl(
        "https://vm.tiktok.com/ZMeXyz456"
      );
      expect(result).toBe(
        "https://www.tiktok.com/@chef_mike/video/7123456789012345678"
      );
    });

    it("resolves mobile share URL via redirects", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({
          status: 302,
          headers: new Headers({
            location:
              "https://www.tiktok.com/@baker_jane/video/7234567890123456789",
          }),
        }).mockResolvedValueOnce({
          status: 200,
          headers: new Headers(),
        })
      );

      const result = await canonicalizeTikTokUrl(
        "https://tiktok.com/t/ABC123"
      );
      expect(result).toBe(
        "https://www.tiktok.com/@baker_jane/video/7234567890123456789"
      );
    });

    it("follows multiple redirects", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            status: 301,
            headers: new Headers({
              location: "https://www.tiktok.com/t/intermediate",
            }),
          })
          .mockResolvedValueOnce({
            status: 302,
            headers: new Headers({
              location:
                "https://www.tiktok.com/@cooker/video/7345678901234567890",
            }),
          })
          .mockResolvedValueOnce({
            status: 200,
            headers: new Headers(),
          })
      );

      const result = await canonicalizeTikTokUrl("vm.tiktok.com/ABC123");
      expect(result).toBe(
        "https://www.tiktok.com/@cooker/video/7345678901234567890"
      );
    });

    it("throws when redirect does not resolve to long-form URL", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({
          status: 200,
          headers: new Headers(),
        })
      );

      await expect(
        canonicalizeTikTokUrl("https://vm.tiktok.com/invalid")
      ).rejects.toThrow("Could not resolve TikTok URL to canonical form");
    });
  });
});
