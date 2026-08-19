/**
 * Unit tests for the Stripe webhook handler — the most consequential file
 * in the credit-pack integration, since it's what actually grants (and
 * claws back) real money's worth of credits. db.transaction is mocked to
 * invoke the real callback against a fake `tx` that records every
 * insert/update, the same approach tests/integration/creator.test.ts uses
 * for confirmCreatorAction's transactional claim.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockConstructEvent, mockCaptureException } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: mockConstructEvent },
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

vi.mock("@/db", () => ({
  db: { transaction: vi.fn() },
}));

import { db } from "@/db";
import { creditPurchases, users } from "@/db/schema";
import { POST } from "./route";

function makeRequest(): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  });
}

function mockTransaction(options: {
  insertReturns?: Array<{ id: string }>;
  clawbackReturns?: Array<{ userId: string | null; creditsAdded: number }>;
} = {}) {
  const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];

  const tx = {
    insert: vi.fn().mockImplementation((table: unknown) => ({
      values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
        insertCalls.push({ table, values });
        return {
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(options.insertReturns ?? [{ id: "purchase-1" }]),
          }),
        };
      }),
    })),
    update: vi.fn().mockImplementation((table: unknown) => ({
      set: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        updateCalls.push({ table, payload });
        if (table === creditPurchases) {
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue(options.clawbackReturns ?? []),
            }),
          };
        }
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };

  vi.mocked(db.transaction).mockImplementation(
    (async (callback: (tx: unknown) => unknown) => callback(tx)) as typeof db.transaction
  );

  return { insertCalls, updateCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects with 400 when the webhook secret isn't configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("rejects with 400 on an invalid signature, without touching the database", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("signature mismatch");
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(mockCaptureException).toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("no-ops on an event type it doesn't handle", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  describe("checkout.session.completed", () => {
    function paidSessionEvent(overrides: Record<string, unknown> = {}) {
      return {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            payment_status: "paid",
            payment_intent: "pi_test_123",
            metadata: {
              userId: "user-1",
              packId: "pack_25",
              credits: "25",
              amountCents: "999",
            },
            ...overrides,
          },
        },
      };
    }

    it("grants credits and records the purchase", async () => {
      const { insertCalls, updateCalls } = mockTransaction();
      mockConstructEvent.mockReturnValue(paidSessionEvent());

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(insertCalls[0].table).toBe(creditPurchases);
      expect(insertCalls[0].values).toMatchObject({
        userId: "user-1",
        stripeSessionId: "cs_test_123",
        stripePaymentIntentId: "pi_test_123",
        packId: "pack_25",
        creditsAdded: 25,
        amountCents: 999,
      });

      const userUpdate = updateCalls.find((c) => c.table === users);
      expect(userUpdate).toBeDefined();
    });

    it("does not grant credits twice for a replayed session id", async () => {
      const { updateCalls } = mockTransaction({ insertReturns: [] });
      mockConstructEvent.mockReturnValue(paidSessionEvent());

      await POST(makeRequest());

      expect(updateCalls.find((c) => c.table === users)).toBeUndefined();
    });

    it("ignores a session whose payment is not yet paid", async () => {
      mockConstructEvent.mockReturnValue(paidSessionEvent({ payment_status: "unpaid" }));

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it("captures and skips a session with missing or invalid metadata, without crashing", async () => {
      mockConstructEvent.mockReturnValue(paidSessionEvent({ metadata: {} }));

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockCaptureException).toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe("checkout.session.async_payment_succeeded", () => {
    it("grants credits the same way completed does", async () => {
      const { insertCalls } = mockTransaction();
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.async_payment_succeeded",
        data: {
          object: {
            id: "cs_test_async",
            payment_status: "paid",
            payment_intent: "pi_test_async",
            metadata: { userId: "user-1", packId: "pack_10", credits: "10", amountCents: "499" },
          },
        },
      });

      await POST(makeRequest());

      expect(insertCalls[0].values).toMatchObject({ creditsAdded: 10 });
    });
  });

  describe("charge.refunded / charge.dispute.created", () => {
    function refundEvent(type: string) {
      return {
        type,
        data: { object: { payment_intent: "pi_test_123" } },
      };
    }

    it("claws back the purchased credits exactly once", async () => {
      const { updateCalls } = mockTransaction({
        clawbackReturns: [{ userId: "user-1", creditsAdded: 25 }],
      });
      mockConstructEvent.mockReturnValue(refundEvent("charge.refunded"));

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      const purchaseUpdate = updateCalls.find((c) => c.table === creditPurchases);
      expect(purchaseUpdate?.payload.refundedAt).toBeInstanceOf(Date);
      const userUpdate = updateCalls.find((c) => c.table === users);
      expect(userUpdate).toBeDefined();
    });

    it("does not claw back twice for a redelivered event", async () => {
      const { updateCalls } = mockTransaction({ clawbackReturns: [] });
      mockConstructEvent.mockReturnValue(refundEvent("charge.refunded"));

      await POST(makeRequest());

      expect(updateCalls.find((c) => c.table === users)).toBeUndefined();
    });

    it("reacts to a dispute the same way it reacts to a refund", async () => {
      const { updateCalls } = mockTransaction({
        clawbackReturns: [{ userId: "user-1", creditsAdded: 10 }],
      });
      mockConstructEvent.mockReturnValue(refundEvent("charge.dispute.created"));

      await POST(makeRequest());

      expect(updateCalls.find((c) => c.table === users)).toBeDefined();
    });
  });
});
