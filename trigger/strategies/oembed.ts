/**
 * Fetches TikTok's oEmbed API — video caption (title field) plus creator
 * metadata (author name/url, thumbnail). Every extraction path uses this
 * directly; the LLM decides whether the caption has recipe content.
 *
 * Timeout: 10 seconds.
 */

import type { OembedMetadata } from "./types";

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
