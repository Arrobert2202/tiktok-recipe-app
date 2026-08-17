import { describe, it, expect } from "vitest";
import { extractTikTokUrlFromShare } from "./share-target";

describe("extractTikTokUrlFromShare", () => {
  it("takes the URL from the url param when it is a bare link", () => {
    expect(
      extractTikTokUrlFromShare({
        url: "https://www.tiktok.com/@chef_mike/video/7123456789012345678",
      })
    ).toBe("https://www.tiktok.com/@chef_mike/video/7123456789012345678");
  });

  it("finds a URL embedded in prose in the text param", () => {
    expect(
      extractTikTokUrlFromShare({
        text: "Check this out! https://vm.tiktok.com/ABC123 #fyp",
      })
    ).toBe("https://vm.tiktok.com/ABC123");
  });

  it("handles short-form vm.tiktok.com links", () => {
    expect(
      extractTikTokUrlFromShare({ url: "https://vm.tiktok.com/ZMeXyz456" })
    ).toBe("https://vm.tiktok.com/ZMeXyz456");
  });

  it("accepts a scheme-less link in the url param", () => {
    expect(extractTikTokUrlFromShare({ url: "vm.tiktok.com/ABC123" })).toBe(
      "vm.tiktok.com/ABC123"
    );
  });

  it("picks the TikTok URL when several URLs are shared", () => {
    expect(
      extractTikTokUrlFromShare({
        text: "https://example.com/blog and https://www.tiktok.com/t/ABC123 plus https://youtube.com/watch?v=x",
      })
    ).toBe("https://www.tiktok.com/t/ABC123");
  });

  it("handles mobile share tiktok.com/t/ links", () => {
    expect(
      extractTikTokUrlFromShare({ url: "https://www.tiktok.com/t/ZTabc123" })
    ).toBe("https://www.tiktok.com/t/ZTabc123");
  });

  it("drops punctuation trailing the URL", () => {
    expect(
      extractTikTokUrlFromShare({
        text: "you have to try this https://vm.tiktok.com/ABC123.",
      })
    ).toBe("https://vm.tiktok.com/ABC123");
  });

  it("drops a trailing comma", () => {
    expect(
      extractTikTokUrlFromShare({
        text: "https://vm.tiktok.com/ABC123, worth a watch",
      })
    ).toBe("https://vm.tiktok.com/ABC123");
  });

  it("drops a closing paren without touching the link", () => {
    expect(
      extractTikTokUrlFromShare({
        text: "dinner sorted (https://vm.tiktok.com/ABC123)",
      })
    ).toBe("https://vm.tiktok.com/ABC123");
  });

  it("keeps a trailing slash, which is part of the link", () => {
    expect(
      extractTikTokUrlFromShare({
        text: "Check out this recipe! https://vm.tiktok.com/ZMabc123/ #fyp #cooking",
      })
    ).toBe("https://vm.tiktok.com/ZMabc123/");
  });

  it("reads past emoji and a title that carries no link", () => {
    expect(
      extractTikTokUrlFromShare({
        title: "TikTok",
        text: "watch this 😍 https://vm.tiktok.com/ZMabc123/",
      })
    ).toBe("https://vm.tiktok.com/ZMabc123/");
  });

  it("prefers the url param over a different link in text", () => {
    expect(
      extractTikTokUrlFromShare({
        url: "https://vm.tiktok.com/FROMURL",
        text: "shared https://vm.tiktok.com/FROMTEXT",
      })
    ).toBe("https://vm.tiktok.com/FROMURL");
  });

  it("falls through to text when url is empty", () => {
    expect(
      extractTikTokUrlFromShare({
        url: "",
        text: "https://vm.tiktok.com/ABC123",
      })
    ).toBe("https://vm.tiktok.com/ABC123");
  });

  it("falls through to title as a last resort", () => {
    expect(
      extractTikTokUrlFromShare({
        url: "",
        text: "no link here",
        title: "TikTok · https://vm.tiktok.com/ABC123",
      })
    ).toBe("https://vm.tiktok.com/ABC123");
  });

  it("returns null for a non-TikTok URL", () => {
    expect(
      extractTikTokUrlFromShare({
        url: "https://www.youtube.com/watch?v=abc123",
      })
    ).toBe(null);
  });

  it("returns null for a TikTok profile link with no video", () => {
    expect(
      extractTikTokUrlFromShare({ text: "https://www.tiktok.com/@chef_mike" })
    ).toBe(null);
  });

  it("returns null when every param is empty", () => {
    expect(extractTikTokUrlFromShare({ url: "", text: "", title: "" })).toBe(
      null
    );
  });

  it("returns null for an empty payload", () => {
    expect(extractTikTokUrlFromShare({})).toBe(null);
  });

  it("returns null when params are null or undefined", () => {
    expect(
      extractTikTokUrlFromShare({ url: null, text: undefined, title: null })
    ).toBe(null);
  });

  it("returns null for whitespace-only params", () => {
    expect(extractTikTokUrlFromShare({ text: "   \n  " })).toBe(null);
  });

  it("keeps query params that TikTok appends to shared links", () => {
    expect(
      extractTikTokUrlFromShare({
        text: "https://www.tiktok.com/@chef/video/7123456789012345678?is_from_webapp=1 nice one",
      })
    ).toBe(
      "https://www.tiktok.com/@chef/video/7123456789012345678?is_from_webapp=1"
    );
  });
});
