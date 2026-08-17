import fc from "fast-check";

/**
 * Shared fast-check generators (arbitraries) for TikTok URL variants.
 * Used across property-based tests to generate valid and invalid URLs.
 *
 * Validates: Requirements 1.1
 */

// Generate valid TikTok usernames: alphanumeric + underscores + dots, 1-24 chars
// The regex in lib/url.ts uses [\w.]+, which matches [a-zA-Z0-9_.]+
export const tiktokUsername = fc.stringMatching(/^[a-zA-Z0-9_.]{1,24}$/);

// Generate valid video IDs: numeric strings, 15-19 digits
export const videoId = fc.string({
  unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  minLength: 15,
  maxLength: 19,
});

// Generate short-form codes: alphanumeric, 6-12 chars
export const shortCode = fc.stringMatching(/^[a-zA-Z0-9]{6,12}$/);

// Generate optional https/www prefixes
const httpPrefix = fc.constantFrom(
  "https://www.",
  "https://",
  "http://www.",
  "http://",
  "www.",
  ""
);

// Generate optional query params (e.g., ?is_from_webapp=1&sender_device=pc)
const queryParams = fc.constantFrom(
  "",
  "?is_from_webapp=1",
  "?is_from_webapp=1&sender_device=pc",
  "?lang=en"
);

// Generate valid long-form TikTok URLs: tiktok.com/@{user}/video/{id}
export const validLongFormUrl = fc
  .tuple(httpPrefix, tiktokUsername, videoId, queryParams)
  .map(
    ([prefix, user, id, query]) =>
      `${prefix}tiktok.com/@${user}/video/${id}${query}`
  );

// Generate valid short-form TikTok URLs: vm.tiktok.com/{shortcode}
export const validShortFormUrl = fc
  .tuple(
    fc.constantFrom("https://", "http://", ""),
    shortCode,
    queryParams
  )
  .map(([prefix, code, query]) => `${prefix}vm.tiktok.com/${code}${query}`);

// Generate valid mobile share TikTok URLs: tiktok.com/t/{shortcode}
export const validMobileUrl = fc
  .tuple(httpPrefix, shortCode, queryParams)
  .map(([prefix, code, query]) => `${prefix}tiktok.com/t/${code}${query}`);

// Generate any valid TikTok URL
export const validTikTokUrl = fc.oneof(
  validLongFormUrl,
  validShortFormUrl,
  validMobileUrl
);

// Generate URLs that are definitely NOT valid TikTok URLs
export const invalidUrl = fc.oneof(
  fc.constant(""),
  fc.constant("https://youtube.com/watch?v=abc123"),
  fc.constant("https://instagram.com/p/abc123"),
  fc.constant("https://twitter.com/user/status/123"),
  fc.constant("not a url at all"),
  fc.constant("https://tiktok.com/"),
  fc.constant("https://tiktok.com/foryou"),
  // Random strings that don't contain tiktok.com patterns
  fc
    .string({ minLength: 1, maxLength: 200 })
    .filter(
      (s) =>
        !s.includes("tiktok.com/@") &&
        !s.includes("vm.tiktok.com/") &&
        !s.includes("tiktok.com/t/")
    )
);

// Generate URLs that exceed the 2048 character limit
export const tooLongUrl = validLongFormUrl.map(
  (url) => url + "a".repeat(Math.max(0, 2049 - url.length))
);
