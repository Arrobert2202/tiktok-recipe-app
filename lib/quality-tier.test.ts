import { describe, it, expect } from "vitest";
import {
  getQualityTierForStrategy,
  QUALITY_TIER_CAPTION,
  QUALITY_TIER_FULL,
} from "./quality-tier";

describe("getQualityTierForStrategy", () => {
  it("maps caption-only extraction to the caption tier", () => {
    expect(getQualityTierForStrategy("oembed_caption")).toBe(QUALITY_TIER_CAPTION);
  });

  it("maps audio-fused and captions-derived strategies to the full tier", () => {
    expect(getQualityTierForStrategy("data_fusion")).toBe(QUALITY_TIER_FULL);
    expect(getQualityTierForStrategy("asr")).toBe(QUALITY_TIER_FULL);
    expect(getQualityTierForStrategy("native_captions")).toBe(QUALITY_TIER_FULL);
  });

  it("the full tier ranks strictly above the caption tier", () => {
    expect(QUALITY_TIER_FULL).toBeGreaterThan(QUALITY_TIER_CAPTION);
  });
});
