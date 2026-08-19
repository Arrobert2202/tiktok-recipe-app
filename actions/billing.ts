"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";
import { CREDIT_PACKS } from "@/lib/credit-packs";

export interface CheckoutResult {
  url?: string;
  error?: string;
}

/**
 * Creates a Stripe Checkout Session for a credit pack and returns the URL
 * to redirect the browser to. Snapshots credits/priceCents into the
 * session's metadata at creation time rather than leaving the webhook to
 * re-derive them from CREDIT_PACKS later — a Checkout Session can sit open
 * in a customer's browser for hours, and a pricing edit in the meantime
 * must not be able to misprice (or fail to find) an already-open session.
 */
export async function createCheckoutSession(packId: string): Promise<CheckoutResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return { error: "You must be signed in to purchase credits." };
  }

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return { error: "Unknown credit pack." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let checkoutSession;
  try {
    checkoutSession = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `RecipeApp — ${pack.label}` },
            unit_amount: pack.priceCents,
          },
          quantity: 1,
        },
      ],
      client_reference_id: session.user.id,
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id,
        packId: pack.id,
        credits: String(pack.credits),
        amountCents: String(pack.priceCents),
      },
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    });
  } catch {
    return { error: "Could not start checkout. Please try again." };
  }

  if (!checkoutSession.url) {
    return { error: "Could not start checkout. Please try again." };
  }

  return { url: checkoutSession.url };
}
