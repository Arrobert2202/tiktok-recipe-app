import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChefHat, ArrowRight } from "lucide-react";
import { extractTikTokUrlFromShare } from "@/lib/share-target";

export const metadata: Metadata = {
  title: "Shared link",
  description: "Turn a shared TikTok cooking video into a recipe.",
  // A share receiver has nothing durable to index.
  robots: { index: false, follow: false },
};

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
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/25">
          <ChefHat className="h-7 w-7 text-white" aria-hidden="true" />
        </div>

        <h1 className="mb-3 text-2xl font-bold text-white sm:text-3xl">
          That didn&apos;t look like a TikTok link
        </h1>
        <p className="mb-8 leading-relaxed text-white/50">
          We only extract recipes from TikTok videos. Share the video itself
          from TikTok, or paste the link on the home page.
        </p>

        {sharedText && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/30">
              What was shared
            </p>
            <p className="break-words font-mono text-sm leading-relaxed text-white/40">
              {truncate(sharedText)}
            </p>
          </div>
        )}

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-700 hover:to-pink-600 active:scale-95"
        >
          Go to RecipeApp
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
