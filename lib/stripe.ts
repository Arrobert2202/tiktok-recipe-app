import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Pinned explicitly rather than left to the SDK default: an unpinned client
 * uses the Stripe *account's* dashboard-configured default API version,
 * which can differ between the test and live accounts and drift out of
 * sync with the response shape the installed `stripe` package's types
 * assume. Bump this deliberately (and re-check the installed package's
 * `node_modules/stripe/esm/apiVersion.js`) when upgrading the dependency.
 */
const STRIPE_API_VERSION = "2026-07-29.dahlia";

export function getStripeClient(): Stripe {
  if (client) return client;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Credit-pack checkout cannot be created without it."
    );
  }
  client = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION });
  return client;
}
