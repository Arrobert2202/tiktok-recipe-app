import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { hashIp, extractClientIp, ANON_FREE_EXTRACTIONS } from "./anon-limit";

describe("hashIp", () => {
  it("returns a 64-char lowercase hex sha256 digest", () => {
    const hash = hashIp("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same IP", () => {
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
  });

  it("produces different hashes for different IPs", () => {
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });

  it("never returns the raw IP", () => {
    const ip = "203.0.113.7";
    expect(hashIp(ip)).not.toContain(ip);
  });

  it("handles IPv6 addresses", () => {
    expect(hashIp("2001:db8::1")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractClientIp", () => {
  it("takes the first entry of x-forwarded-for (the client, not the proxies)", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178",
    });
    expect(extractClientIp(headers)).toBe("203.0.113.7");
  });

  it("handles a single-entry x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(extractClientIp(headers)).toBe("203.0.113.7");
  });

  it("trims surrounding whitespace", () => {
    const headers = new Headers({ "x-forwarded-for": "  203.0.113.7 , 70.41.3.18" });
    expect(extractClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.4" });
    expect(extractClientIp(headers)).toBe("198.51.100.4");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "198.51.100.4",
    });
    expect(extractClientIp(headers)).toBe("203.0.113.7");
  });

  it("returns \"unknown\" when no IP headers are present", () => {
    expect(extractClientIp(new Headers())).toBe("unknown");
  });

  it("falls back when x-forwarded-for is empty or whitespace-only", () => {
    expect(extractClientIp(new Headers({ "x-forwarded-for": "" }))).toBe("unknown");
    expect(extractClientIp(new Headers({ "x-forwarded-for": "   " }))).toBe("unknown");
    expect(
      extractClientIp(new Headers({ "x-forwarded-for": "  ", "x-real-ip": "198.51.100.4" }))
    ).toBe("198.51.100.4");
  });
});

describe("ANON_FREE_EXTRACTIONS", () => {
  it("allows exactly one free anonymous extraction", () => {
    expect(ANON_FREE_EXTRACTIONS).toBe(1);
  });
});

describe("anon-limit properties", () => {
  it("hashIp is total, deterministic, and shape-stable for any string input", () => {
    fc.assert(
      fc.property(fc.string(), (ip) => {
        const first = hashIp(ip);
        expect(first).toMatch(/^[0-9a-f]{64}$/);
        expect(hashIp(ip)).toBe(first);
      })
    );
  });

  it("extractClientIp always returns a non-empty, untrimmed-free value", () => {
    const ipArb = fc
      .array(fc.ipV4(), { minLength: 1, maxLength: 5 })
      .map((ips) => ips.join(", "));

    fc.assert(
      fc.property(fc.option(ipArb, { nil: undefined }), fc.option(fc.ipV4(), { nil: undefined }), (fwd, real) => {
        const headers = new Headers();
        if (fwd !== undefined) headers.set("x-forwarded-for", fwd);
        if (real !== undefined) headers.set("x-real-ip", real);

        const result = extractClientIp(headers);

        expect(result.length).toBeGreaterThan(0);
        expect(result).toBe(result.trim());

        if (fwd !== undefined) {
          // Always the first hop — the originating client
          expect(result).toBe(fwd.split(",")[0].trim());
        } else if (real !== undefined) {
          expect(result).toBe(real);
        } else {
          expect(result).toBe("unknown");
        }
      })
    );
  });
});
