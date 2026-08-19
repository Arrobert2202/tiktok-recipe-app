import { describe, it, expect } from "vitest";
import { estimateCostMicros, microsToDollars } from "./openai-pricing";

describe("estimateCostMicros", () => {
  it("returns 0 for no usage", () => {
    expect(estimateCostMicros({})).toBe(0);
  });

  it("prices prompt and completion tokens independently (output costs 4x input)", () => {
    const promptOnly = estimateCostMicros({ promptTokens: 1_000_000 });
    const completionOnly = estimateCostMicros({ completionTokens: 1_000_000 });

    expect(promptOnly).toBe(150_000); // $0.15/1M tokens = 150,000 micros/1M tokens
    expect(completionOnly).toBe(600_000); // $0.60/1M tokens
    expect(completionOnly).toBe(promptOnly * 4);
  });

  it("prices audio duration at whisper-1's per-minute rate", () => {
    const oneMinute = estimateCostMicros({ audioSeconds: 60 });
    // $0.006/min = 6,000 micros/min
    expect(oneMinute).toBe(6_000);
  });

  it("sums all three components for a typical data-fusion extraction", () => {
    // ~1500 prompt tokens (caption + transcript + instructions), ~400
    // completion tokens (structured recipe), 90 seconds of audio.
    const micros = estimateCostMicros({
      promptTokens: 1500,
      completionTokens: 400,
      audioSeconds: 90,
    });

    expect(micros).toBe(Math.round(1500 * 0.15 + 400 * 0.6 + 90 * 100));
  });

  it("never returns a fractional micro-dollar", () => {
    const micros = estimateCostMicros({ promptTokens: 7, completionTokens: 3 });
    expect(Number.isInteger(micros)).toBe(true);
  });
});

describe("microsToDollars", () => {
  it("converts micro-dollars to a real dollar figure", () => {
    expect(microsToDollars(1_000_000)).toBe(1);
    expect(microsToDollars(6_000)).toBe(0.006);
  });
});
