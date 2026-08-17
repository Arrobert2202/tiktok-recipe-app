import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest.
 *
 * `share_target` is what puts RecipeApp in the Android share sheet: TikTok
 * hands us the shared link and /share turns it into an extraction. iOS has no
 * Web Share Target support, so an iOS Shortcut opens /share?url=... instead
 * (see /install).
 *
 * Next 16's `MetadataRoute.Manifest` types `share_target`, so no cast needed.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RecipeApp — TikTok Recipe Extractor",
    short_name: "RecipeApp",
    description:
      "Turn any TikTok cooking video into a recipe you can cook from.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
