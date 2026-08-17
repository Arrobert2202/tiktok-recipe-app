import { validateTikTokUrl } from "./url";

/**
 * Pulling a TikTok link out of whatever Android's share sheet hands us.
 *
 * Share sheets are inconsistent about which param carries the link. TikTok
 * usually drops the URL into `text` alongside other words — "Check this out!
 * https://vm.tiktok.com/ABC123 #fyp" — and often leaves `url` empty. So we
 * scan for URL candidates instead of trusting any single param to be a bare URL.
 */

export type SharePayload = {
  url?: string | null;
  text?: string | null;
  title?: string | null;
};

/** Candidate URLs inside prose. Deliberately greedy; trimmed up afterwards. */
const URL_CANDIDATE = /https?:\/\/\S+/gi;

/**
 * Sentence punctuation that can trail a pasted link. "…/ABC123." must not
 * resolve to a URL with the full stop attached, since the pattern in `url.ts`
 * is prefix-anchored and would happily accept it.
 */
const TRAILING_PUNCTUATION = /[.,!?;:'"“”’)\]}>]+$/;

/**
 * Returns the first TikTok URL found in a share payload, or null.
 *
 * Params are checked in order of trustworthiness: `url`, then `text`, then
 * `title`. Validation is delegated to `validateTikTokUrl` so the accepted
 * link shapes stay defined in exactly one place.
 */
export function extractTikTokUrlFromShare(
  payload: SharePayload
): string | null {
  for (const field of [payload.url, payload.text, payload.title]) {
    const found = findTikTokUrl(field);
    if (found) return found;
  }
  return null;
}

function findTikTokUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Whole-value first: catches scheme-less links like "vm.tiktok.com/ABC123",
  // which the http(s)-anchored scan below would miss.
  if (!/\s/.test(trimmed)) {
    const cleaned = stripTrailingPunctuation(trimmed);
    if (validateTikTokUrl(cleaned)) return cleaned;
  }

  for (const candidate of trimmed.match(URL_CANDIDATE) ?? []) {
    const cleaned = stripTrailingPunctuation(candidate);
    if (validateTikTokUrl(cleaned)) return cleaned;
  }

  return null;
}

function stripTrailingPunctuation(candidate: string): string {
  return candidate.replace(TRAILING_PUNCTUATION, "");
}
