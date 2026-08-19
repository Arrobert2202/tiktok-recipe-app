import { randomBytes } from "node:crypto";

/**
 * Generates a security token for an email confirmation link.
 *
 * Not lib/slug.ts's nanoid generator — that's sized for short, public-facing
 * URLs (12 chars over a 36-symbol alphabet), not the entropy a token
 * standing in for identity verification needs. 32 random bytes, base64url
 * so it's URL-safe with no padding to strip.
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}
