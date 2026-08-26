import type { Metadata } from "next";
import { InstallPageContent } from "@/components/install-page-content";

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

export default function InstallPage() {
  return <InstallPageContent shortcutUrlPrefix={SHORTCUT_URL_PREFIX} />;
}
