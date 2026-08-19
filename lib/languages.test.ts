import { describe, it, expect } from "vitest";
import { normalizeLanguageCode, getLanguageNameForCode } from "./languages";

describe("normalizeLanguageCode", () => {
  it("passes through a known lowercase code unchanged", () => {
    expect(normalizeLanguageCode("es")).toBe("es");
  });

  it("lowercases a known code given in a different case", () => {
    expect(normalizeLanguageCode("ES")).toBe("es");
    expect(normalizeLanguageCode("Fr")).toBe("fr");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeLanguageCode("  de  ")).toBe("de");
  });

  it("defaults to en for an unrecognized code", () => {
    expect(normalizeLanguageCode("xx")).toBe("en");
    expect(normalizeLanguageCode("not-a-language")).toBe("en");
  });

  it("defaults to en when undefined or empty", () => {
    expect(normalizeLanguageCode(undefined)).toBe("en");
    expect(normalizeLanguageCode("")).toBe("en");
    expect(normalizeLanguageCode("   ")).toBe("en");
  });

  it("is idempotent — normalizing twice gives the same result", () => {
    const once = normalizeLanguageCode(" JA ");
    expect(normalizeLanguageCode(once)).toBe(once);
  });
});

describe("getLanguageNameForCode", () => {
  it("returns the display name for a known code", () => {
    expect(getLanguageNameForCode("ko")).toBe("Korean");
  });

  it("falls back to English for an unknown code", () => {
    expect(getLanguageNameForCode("xx")).toBe("English");
  });
});
