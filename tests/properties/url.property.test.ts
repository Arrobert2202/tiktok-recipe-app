import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateTikTokUrl, canonicalizeTikTokUrl } from "@/lib/url";
import {
  validTikTokUrl,
  invalidUrl,
  tooLongUrl,
  validLongFormUrl,
} from "./generators/url.gen";

/**
 * Property 1: TikTok URL Validation Correctness
 *
 * Validates: Requirements 1.1, 1.2, 1.6
 */
describe("Property: TikTok URL Validation Correctness", () => {
  it("accepts all valid TikTok URLs", () => {
    fc.assert(
      fc.property(validTikTokUrl, (url) => {
        expect(validateTikTokUrl(url)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects all invalid URLs", () => {
    fc.assert(
      fc.property(invalidUrl, (url) => {
        expect(validateTikTokUrl(url)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects all URLs exceeding 2048 characters", () => {
    fc.assert(
      fc.property(tooLongUrl, (url) => {
        expect(url.length).toBeGreaterThan(2048);
        expect(validateTikTokUrl(url)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 11: URL Canonicalization Determinism
 *
 * Validates: Requirements 1.1, 1.2
 *
 * Tests that canonicalization of long-form TikTok URLs is deterministic,
 * idempotent, and strips query params while normalizing the prefix.
 * Only long-form URLs are tested (short/mobile URLs require network).
 */
describe("Property: URL Canonicalization Determinism", () => {
  it("produces canonical format https://www.tiktok.com/@{user}/video/{id} for any long-form URL", () => {
    fc.assert(
      fc.asyncProperty(validLongFormUrl, async (url) => {
        const canonical = await canonicalizeTikTokUrl(url);
        expect(canonical).toMatch(
          /^https:\/\/www\.tiktok\.com\/@[\w.]+\/video\/\d+$/
        );
      }),
      { numRuns: 100 }
    );
  });

  it("is idempotent: canonicalize(canonicalize(url)) === canonicalize(url)", () => {
    fc.assert(
      fc.asyncProperty(validLongFormUrl, async (url) => {
        const once = await canonicalizeTikTokUrl(url);
        const twice = await canonicalizeTikTokUrl(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });

  it("URLs with different query params but same user/video ID produce same canonical URL", () => {
    fc.assert(
      fc.asyncProperty(
        validLongFormUrl,
        fc.constantFrom(
          "?foo=bar",
          "?is_from_webapp=1&sender_device=pc",
          "?lang=en&region=US",
          ""
        ),
        async (url, extraQuery) => {
          // Strip any existing query from the generated URL to get a clean base
          const baseUrl = url.split("?")[0];
          const urlWithQuery = baseUrl + extraQuery;

          const canonicalBase = await canonicalizeTikTokUrl(baseUrl);
          const canonicalWithQuery =
            await canonicalizeTikTokUrl(urlWithQuery);
          expect(canonicalWithQuery).toBe(canonicalBase);
        }
      ),
      { numRuns: 100 }
    );
  });
});
