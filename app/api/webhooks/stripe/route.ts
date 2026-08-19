import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";
import { db } from "@/db";
import { creditPurchases, users } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getStripeClient } from "@/lib/stripe";

// Stripe signature verification needs Node's crypto — this route must not
// silently inherit the edge runtime the way app/api/card/[slug]/route.tsx
// and app/api/og/[slug]/route.tsx do.
export const runtime = "nodejs";

function paymentIntentIdFrom(object: { payment_intent: string | Stripe.PaymentIntent | null }) {
  const pi = object.payment_intent;
  return typeof pi === "string" ? pi : (pi?.id ?? null);
}

/**
 * Grants credits for a completed Checkout Session, exactly once per
 * session. Trusts the credits/amountCents metadata snapshotted at session
 * creation (actions/billing.ts) rather than re-reading CREDIT_PACKS here —
 * the catalog can change between session creation and payment, but what
 * was actually charged can't.
 *
 * The INSERT's unique constraint on stripeSessionId is the idempotency
 * guard: Stripe delivers webhooks at-least-once, and checkout.session.completed
 * plus checkout.session.async_payment_succeeded can both fire for the same
 * session. Both statements run against the same transaction handle so the
 * ledger row and the credit grant can't diverge if the process dies
 * mid-way.
 */
async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const packId = session.metadata?.packId;
  const credits = Number(session.metadata?.credits);
  const amountCents = Number(session.metadata?.amountCents);

  if (!userId || !packId || !Number.isInteger(credits) || credits <= 0 || !Number.isFinite(amountCents)) {
    Sentry.captureException(
      new Error(`Stripe checkout.session.completed with invalid metadata: session ${session.id}`)
    );
    return;
  }

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(creditPurchases)
      .values({
        userId,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentIdFrom(session),
        packId,
        creditsAdded: credits,
        amountCents,
      })
      .onConflictDoNothing()
      .returning({ id: creditPurchases.id });

    if (!inserted) return; // already processed this session

    await tx
      .update(users)
      .set({ credits: sql`${users.credits} + ${credits}` })
      .where(eq(users.id, userId));
  });
}

/**
 * Claws back credits when a payment is reversed after the fact. Guarded by
 * refundedAt IS NULL the same way extractionJobs.creditRefunded guards its
 * one-shot refund, so a redelivered charge.refunded/charge.dispute.created
 * event can't claw back twice. Floors at 0 rather than going negative,
 * since the credits may already have been spent on extractions.
 */
async function clawbackCredits(paymentIntentId: string) {
  await db.transaction(async (tx) => {
    const [purchase] = await tx
      .update(creditPurchases)
      .set({ refundedAt: new Date() })
      .where(
        and(
          eq(creditPurchases.stripePaymentIntentId, paymentIntentId),
          isNull(creditPurchases.refundedAt)
        )
      )
      .returning({ userId: creditPurchases.userId, creditsAdded: creditPurchases.creditsAdded });

    if (!purchase || !purchase.userId) return;

    await tx
      .update(users)
      .set({ credits: sql`GREATEST(${users.credits} - ${purchase.creditsAdded}, 0)` })
      .where(eq(users.id, purchase.userId));
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          await fulfillCheckout(session);
        }
        break;
      }
      case "charge.refunded":
      case "charge.dispute.created": {
        const object = event.data.object as Stripe.Charge | Stripe.Dispute;
        const paymentIntentId = paymentIntentIdFrom(object);
        if (paymentIntentId) {
          await clawbackCredits(paymentIntentId);
        }
        break;
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
