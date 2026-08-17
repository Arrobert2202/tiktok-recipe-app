import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat, Share2, Smartphone, Apple } from "lucide-react";

export const metadata: Metadata = {
  title: "Install RecipeApp",
  description:
    "Put RecipeApp in your phone's share sheet so any TikTok cooking video becomes a recipe in two taps.",
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** What the iOS Shortcut's "Open URL" action points at, minus the link itself. */
const SHORTCUT_URL_PREFIX = `${appUrl}/share?url=`;

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO (owner, before launch): replace the manual iOS instructions below with a
 * one-tap install.
 *
 * Building a Shortcut by hand is nine fiddly steps inside an app most people
 * have never opened, and it is the biggest drop-off point in this whole flow.
 * Every iPhone user who bails here never gets RecipeApp into their share sheet.
 *
 * The fix is to build the Shortcut once, yourself, then share it:
 *   1. Shortcuts app → new shortcut, exactly as the steps below describe.
 *   2. Shortcut details → enable "Show in Share Sheet", accepted input: URLs.
 *   3. Add an "Open URL" action with `${SHORTCUT_URL_PREFIX}` + Shortcut Input.
 *   4. Share → Copy iCloud Link. That link installs the Shortcut in one tap.
 *   5. Put the link in an "Add to iPhone" button here and collapse the manual
 *      steps into a "set it up by hand instead" disclosure.
 *
 * This cannot be generated from source: a .shortcut file is a signed Apple
 * property list, and iCloud share links are minted by the Shortcuts app on a
 * real device. It needs a human with an iPhone, once.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ANDROID_STEPS = [
  "Open this site in Chrome (not an in-app browser).",
  'Tap the ⋮ menu, then "Install app" or "Add to Home screen".',
  "Confirm. RecipeApp lands on your home screen like any other app.",
];

const IOS_STEPS = [
  "Open the Shortcuts app and tap + to create a new shortcut.",
  'Open the shortcut\'s details (the ⓘ or settings icon) and turn on "Show in Share Sheet".',
  'Under "Share Sheet Types", clear everything except URLs.',
  'Add an "Open URL" action.',
  "Set the URL to the address below, then tap the Shortcut Input variable so it lands immediately after the equals sign.",
  'Name it "RecipeApp" and save.',
];

export default function InstallPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/25">
        <ChefHat className="h-7 w-7 text-white" aria-hidden="true" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Install RecipeApp</h1>
      <p className="text-white/70 leading-relaxed">
        Installing does one thing that matters: it puts RecipeApp in your
        phone&apos;s share sheet. Then you never copy a link again. You&apos;re
        watching a cooking video, you tap share, you tap RecipeApp, and the
        recipe extracts itself.
      </p>

      {/* ─── Android ─── */}
      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="h-5 w-5 text-purple-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-white">
            Android — full share sheet support
          </h2>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-white/70">
          {ANDROID_STEPS.map((step) => (
            <li key={step} className="leading-relaxed">
              {step}
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="h-4 w-4 text-purple-300" aria-hidden="true" />
            <p className="font-semibold text-white">Then, in TikTok</p>
          </div>
          <p className="text-white/80 leading-relaxed">
            Tap share on any cooking video and RecipeApp appears in the share
            sheet alongside your messaging apps. Tap it, and extraction starts
            automatically. No pasting, no switching apps first.
          </p>
        </div>
      </section>

      {/* ─── iOS ─── */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Apple className="h-5 w-5 text-pink-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-white">
            iPhone and iPad — one extra step
          </h2>
        </div>

        <p className="text-white/70 leading-relaxed">
          Straight answer: Safari doesn&apos;t support Web Share Targets, so
          adding RecipeApp to your home screen will{" "}
          <strong className="font-semibold text-white">not</strong> put it in
          the share sheet. That&apos;s an Apple limitation and nothing we can
          work around from the web.
        </p>
        <p className="mt-3 text-white/70 leading-relaxed">
          The workaround is an iOS Shortcut, which gets you the same two-tap
          flow. It takes about two minutes to set up once.
        </p>

        <ol className="mt-5 list-decimal list-inside space-y-2 text-white/70">
          {IOS_STEPS.map((step) => (
            <li key={step} className="leading-relaxed">
              {step}
            </li>
          ))}
        </ol>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/30">
            URL for the Open URL action
          </p>
          <code className="block break-all rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-purple-300">
            {SHORTCUT_URL_PREFIX}
            <span className="text-pink-300">[Shortcut Input]</span>
          </code>
          <p className="mt-2 text-sm text-white/50 leading-relaxed">
            The bracketed part isn&apos;t typed out. It&apos;s the Shortcut Input
            variable, inserted from the variable picker above the keyboard.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-pink-500/30 bg-pink-500/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="h-4 w-4 text-pink-300" aria-hidden="true" />
            <p className="font-semibold text-white">Then, in TikTok</p>
          </div>
          <p className="text-white/80 leading-relaxed">
            Tap share, scroll the share sheet to your shortcuts row, and tap
            RecipeApp. The video&apos;s link opens here and extraction starts.
          </p>
        </div>
      </section>

      <p className="mt-10 text-white/70 leading-relaxed">
        Either way, you can always skip installing and paste a link on the{" "}
        <Link
          href="/"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          home page
        </Link>
        .
      </p>
    </main>
  );
}
