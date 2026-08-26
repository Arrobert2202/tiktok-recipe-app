import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { extractTikTokUrlFromShare } from "@/lib/share-target";
import { ShareFallbackContent } from "@/components/share-fallback-content";
import { getServerLanguage, translateForMetadata } from "@/lib/get-server-language";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage();

  return {
    title: translateForMetadata("metadata.share.title", language),
    description: translateForMetadata("metadata.share.description", language),
    // A share receiver has nothing durable to index.
    robots: { index: false, follow: false },
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

/** Share sheets occasionally repeat a param; the first value is the payload. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Long enough to recognise what was shared, short enough not to become the page. */
const MAX_ECHO_LENGTH = 280;

function truncate(value: string): string {
  return value.length > MAX_ECHO_LENGTH
    ? `${value.slice(0, MAX_ECHO_LENGTH).trimEnd()}…`
    : value;
}

/**
 * Target of the manifest's `share_target`, and of the iOS Shortcut described
 * on /install.
 *
 * On a hit we bounce to `/?url=...` so extraction has exactly one code path
 * (see the auto-extract effect in the landing and home pages).
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const shared = {
    url: first(params.url),
    text: first(params.text),
    title: first(params.title),
  };

  const tiktokUrl = extractTikTokUrlFromShare(shared);

  if (tiktokUrl) {
    redirect(`/?url=${encodeURIComponent(tiktokUrl)}`);
  }

  const sharedText = [shared.text, shared.url, shared.title]
    .map((value) => value?.trim())
    .find((value) => value);

  return (
    <ShareFallbackContent
      truncatedSharedText={sharedText ? truncate(sharedText) : undefined}
    />
  );
}
