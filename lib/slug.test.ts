import { describe, it, expect } from "vitest";
import { generateSlug } from "./slug";

describe("generateSlug", () => {
  it("generates a 12-character string", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(12);
  });

  it("contains only lowercase alphanumeric characters", () => {
    const slug = generateSlug();
    expect(slug).toMatch(/^[a-z0-9]{12}$/);
  });

  it("generates unique slugs on successive calls", () => {
    const slugs = new Set(Array.from({ length: 100 }, () => generateSlug()));
    expect(slugs.size).toBe(100);
  });
});
