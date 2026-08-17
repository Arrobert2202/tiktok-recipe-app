/**
 * TikTok URL validation and canonicalization utilities.
 *
 * Supports three URL formats:
 * - Long-form: tiktok.com/@user/video/1234567890
 * - Short-form: vm.tiktok.com/ABC123
 * - Mobile share: tiktok.com/t/ABC123
 */

const TIKTOK_PATTERNS = [
  // Long-form: tiktok.com/@user/video/1234567890
  /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.]+)\/video\/(\d+)/,
  // Short-form: vm.tiktok.com/ABC123
  /^(?:https?:\/\/)?vm\.tiktok\.com\/([\w]+)/,
  // Mobile share: tiktok.com/t/ABC123
  /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([\w]+)/,
];

const LONG_FORM_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.]+)\/video\/(\d+)/;

const MAX_URL_LENGTH = 2048;

/**
 * Validates whether a string is a recognized TikTok video URL.
 * Accepts long-form, short-form, and mobile share patterns
 * with or without https://www prefix and regardless of trailing query parameters.
 * Rejects URLs exceeding 2048 characters.
 */
export function validateTikTokUrl(url: string): boolean {
  if (url.length > MAX_URL_LENGTH) return false;
  return TIKTOK_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extracts the @handle (creator username) from a long-form TikTok URL.
 * Returns null if the URL does not match the long-form pattern.
 */
export function extractCreatorHandle(url: string): string | null {
  const match = url.match(LONG_FORM_PATTERN);
  if (!match) return null;
  return match[1];
}

/**
 * Resolves short-form and mobile share TikTok URLs to their canonical long-form,
 * and normalizes long-form URLs by stripping query params.
 *
 * Canonical form: https://www.tiktok.com/@{user}/video/{id}
 *
 * For short/mobile links, follows HTTP redirects to resolve the long-form URL.
 * Idempotent: applying to an already-canonical URL returns the same URL.
 */
export async function canonicalizeTikTokUrl(url: string): Promise<string> {
  // First, check if it's already a long-form URL
  const longFormMatch = url.match(LONG_FORM_PATTERN);
  if (longFormMatch) {
    const user = longFormMatch[1];
    const videoId = longFormMatch[2];
    return `https://www.tiktok.com/@${user}/video/${videoId}`;
  }

  // For short-form or mobile share links, follow redirects to resolve
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  const resolvedUrl = await followRedirects(normalizedUrl);

  // Parse the resolved URL as a long-form URL
  const resolvedMatch = resolvedUrl.match(LONG_FORM_PATTERN);
  if (!resolvedMatch) {
    throw new Error(
      `Could not resolve TikTok URL to canonical form: ${url}`
    );
  }

  const user = resolvedMatch[1];
  const videoId = resolvedMatch[2];
  return `https://www.tiktok.com/@${user}/video/${videoId}`;
}

/**
 * Follows HTTP redirects manually using fetch with redirect: 'manual'.
 * Follows up to maxRedirects hops (default 10).
 */
async function followRedirects(
  url: string,
  maxRedirects: number = 10
): Promise<string> {
  let currentUrl = url;

  for (let i = 0; i < maxRedirects; i++) {
    const response = await fetch(currentUrl, { redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;

      // Handle relative redirects
      currentUrl = location.startsWith("http")
        ? location
        : new URL(location, currentUrl).toString();
    } else {
      // No more redirects — return the final URL
      return currentUrl;
    }
  }

  return currentUrl;
}
