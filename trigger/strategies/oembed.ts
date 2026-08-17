/**
 * oEmbed extraction strategy.
 *
 * Fetches TikTok's oEmbed API to retrieve the video caption (title field),
 * then passes it to the LLM for recipe extraction if it has meaningful content.
 *
 * Timeout: 10 seconds.
 */

import type { StrategyResult, OembedMetadata } from "./types";

const OEMBED_TIMEOUT_MS = 10_000;

interface OembedResponse {
  title: string;
  author_name: string;
  author_url: string;
  html: string;
  thumbnail_url: string;
  [key: string]: unknown;
}

/**
 * Fetches full oEmbed metadata from TikTok for the given canonical URL.
 * Useful for extracting creator info (author_name, author_url, thumbnail_url).
 */
export async function fetchOembedMetadata(
  canonicalUrl: string
): Promise<OembedMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OembedResponse;

    return {
      title: data.title,
      authorName: data.author_name,
      authorUrl: data.author_url,
      thumbnailUrl: data.thumbnail_url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Attempts to extract recipe text from the TikTok video caption via oEmbed.
 *
 * Returns a StrategyResult if the caption has meaningful content (at least 10 chars),
 * or null otherwise. The LLM decides if it contains a recipe.
 */
export async function tryOembedCaption(
  canonicalUrl: string
): Promise<StrategyResult | null> {
  const start = Date.now();

  const metadata = await fetchOembedMetadata(canonicalUrl);

  if (!metadata) {
    return null;
  }

  const caption = metadata.title;

  // Accept any caption with meaningful content (at least 10 chars)
  // Let the LLM decide if it contains a recipe
  if (!caption || caption.trim().length < 10) {
    return null;
  }

  return {
    text: caption,
    strategy: "oembed_caption",
    durationMs: Date.now() - start,
  };
}
