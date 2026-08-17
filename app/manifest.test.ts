import { describe, it, expect } from "vitest";
import manifest from "./manifest";

/**
 * The manifest is the entire Android install + share sheet contract. A typo in
 * `share_target.action` or an icon `src` fails silently in production: the app
 * still installs, it just never shows up when someone taps share in TikTok.
 */
describe("manifest", () => {
  it("declares a GET share target pointing at the /share receiver", () => {
    const { share_target: shareTarget } = manifest();

    expect(shareTarget).toEqual({
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    });
  });

  it("is installable: standalone display, start_url, and both icon sizes", () => {
    const result = manifest();

    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/");
    expect(result.name).toBeTruthy();
    expect(result.short_name).toBeTruthy();

    expect(result.icons).toEqual([
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ]);
  });

  it("points every icon at a size the /icons route actually serves", () => {
    // Kept in step with ALLOWED_SIZES in app/icons/[size]/route.tsx.
    const servedSizes = ["192", "512"];

    for (const icon of manifest().icons ?? []) {
      const [, size] = icon.src.split("/icons/");
      expect(servedSizes).toContain(size);
    }
  });

  it("uses an opaque theme colour matching the app background", () => {
    const result = manifest();

    expect(result.theme_color).toBe("#0a0a0f");
    expect(result.background_color).toBe("#0a0a0f");
  });
});
