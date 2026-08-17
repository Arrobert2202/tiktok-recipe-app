import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { users, sessions, accounts, verifications } from "@/db/schema";

/**
 * Better Auth signs session tokens with this secret. With no secret configured
 * it falls back to a hard-coded default that ships in the package, which makes
 * session tokens forgeable by anyone who reads the source. Tolerable on a dev
 * machine, not tolerable deployed.
 *
 * Better Auth does raise its own error for the default secret in production,
 * but it does so lazily, from inside async context creation, where the message
 * gets swallowed into render output and is easy to miss. This guard states the
 * problem and the fix up front instead.
 *
 * Why the check can't be `NODE_ENV === "production"` alone: `next build` also
 * runs with NODE_ENV=production and evaluates this module while prerendering,
 * so an unconditional throw would break builds on any machine without the
 * secret. Next sets NEXT_PHASE during the build (child render workers inherit
 * it), so it distinguishes "building" from "serving".
 *
 * Both names are accepted because Better Auth itself reads
 * `BETTER_AUTH_SECRET || AUTH_SECRET` — treating only the first as valid would
 * throw on a setup that actually works.
 */
const NEXT_PRODUCTION_BUILD = "phase-production-build";

function resolveAuthSecret(): string | undefined {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();

  if (secret) {
    return secret;
  }

  const isBuild = process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD;

  if (process.env.NODE_ENV === "production" && !isBuild) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Better Auth would fall back to its " +
        "default signing secret, which makes session tokens forgeable. " +
        "Set BETTER_AUTH_SECRET in the deployment environment. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  console.warn(
    "[auth] BETTER_AUTH_SECRET is not set; falling back to Better Auth's " +
      "default signing secret. Fine for local development, but sessions are " +
      "not secure. Generate one with: openssl rand -base64 32"
  );

  return undefined;
}

// Module scope, so this runs once per process rather than once per request.
const authSecret = resolveAuthSecret();

export const auth = betterAuth({
  // `undefined` leaves Better Auth's own env lookup and default fallback
  // intact, which is what keeps local development working unchanged.
  secret: authSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  account: {
    // A user who signed up one way and later authenticates with Google should
    // land on the existing account rather than hitting an "account already
    // exists" error or getting a duplicate row.
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
});
