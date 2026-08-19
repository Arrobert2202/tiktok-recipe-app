import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession, mockCreateCheckoutSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCreateCheckoutSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: mockCreateCheckoutSession } },
  }),
}));

import { createCheckoutSession } from "./billing";

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await createCheckoutSession("pack_10");

    expect(result.error).toBeTruthy();
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns an error for an unknown pack id", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "a@b.com" } });

    const result = await createCheckoutSession("not_a_real_pack");

    expect(result.error).toBeTruthy();
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates a Checkout Session with the right amount and a full metadata snapshot", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "a@b.com" } });
    mockCreateCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/session-abc" });

    const result = await createCheckoutSession("pack_25");

    expect(result).toEqual({ url: "https://checkout.stripe.com/session-abc" });
    expect(mockCreateCheckoutSession).toHaveBeenCalledTimes(1);

    const args = mockCreateCheckoutSession.mock.calls[0][0];
    expect(args.mode).toBe("payment");
    expect(args.client_reference_id).toBe("user-1");
    expect(args.customer_email).toBe("a@b.com");
    expect(args.line_items[0].price_data.unit_amount).toBe(999);
    expect(args.metadata).toEqual({
      userId: "user-1",
      packId: "pack_25",
      credits: "25",
      amountCents: "999",
    });
  });

  it("returns an error when Stripe session creation fails", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "a@b.com" } });
    mockCreateCheckoutSession.mockRejectedValue(new Error("network error"));

    const result = await createCheckoutSession("pack_10");

    expect(result.error).toBeTruthy();
  });

  it("returns an error when Stripe returns no url", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "a@b.com" } });
    mockCreateCheckoutSession.mockResolvedValue({ url: null });

    const result = await createCheckoutSession("pack_10");

    expect(result.error).toBeTruthy();
  });
});
