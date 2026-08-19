import { describe, it, expect } from "vitest";
import { generateVerificationToken } from "./verification-token";

describe("generateVerificationToken", () => {
  it("returns a URL-safe string", () => {
    const token = generateVerificationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("has enough length to reflect 32 bytes of entropy (base64url, no padding)", () => {
    const token = generateVerificationToken();
    expect(token.length).toBeGreaterThanOrEqual(42);
  });

  it("is different on every call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateVerificationToken()));
    expect(tokens.size).toBe(20);
  });
});
