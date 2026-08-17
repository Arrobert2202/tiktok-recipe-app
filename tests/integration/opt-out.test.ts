import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/db module
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

// Mock @/lib/opt-out-cache module
vi.mock("@/lib/opt-out-cache", () => ({
  invalidateOptOutCache: vi.fn(),
}));

import { submitOptOutRequest, reverseOptOut } from "@/actions/creator";
import { invalidateOptOutCache } from "@/lib/opt-out-cache";

describe("Creator opt-out lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitOptOutRequest", () => {
    it("returns error for invalid handle format", async () => {
      const result = await submitOptOutRequest("", "user@example.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid TikTok handle");
    });

    it("returns error for handle with invalid characters", async () => {
      const result = await submitOptOutRequest(
        "user@handle!",
        "user@example.com"
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid TikTok handle");
    });

    it("returns error for handle exceeding 24 characters", async () => {
      const longHandle = "a".repeat(25);
      const result = await submitOptOutRequest(longHandle, "user@example.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid TikTok handle");
    });

    it("returns error for invalid email format", async () => {
      const result = await submitOptOutRequest("valid_handle", "not-an-email");
      expect(result.success).toBe(false);
      expect(result.error).toContain("valid email");
    });

    it("returns error for empty email", async () => {
      const result = await submitOptOutRequest("valid_handle", "");
      expect(result.success).toBe(false);
      expect(result.error).toContain("valid email");
    });

    it("returns success for valid opt-out request", async () => {
      const result = await submitOptOutRequest(
        "chef_creator",
        "chef@example.com"
      );
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("reverseOptOut", () => {
    it("returns error for invalid handle format", async () => {
      const result = await reverseOptOut("", "user@example.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid TikTok handle");
    });

    it("returns error for handle with spaces", async () => {
      const result = await reverseOptOut("has spaces", "user@example.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid TikTok handle");
    });

    it("returns error for invalid email format", async () => {
      const result = await reverseOptOut("valid_handle", "bad-email");
      expect(result.success).toBe(false);
      expect(result.error).toContain("valid email");
    });

    it("returns error for empty email", async () => {
      const result = await reverseOptOut("valid_handle", "");
      expect(result.success).toBe(false);
      expect(result.error).toContain("valid email");
    });

    it("returns success for valid reversal request", async () => {
      const result = await reverseOptOut("chef_creator", "chef@example.com");
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
