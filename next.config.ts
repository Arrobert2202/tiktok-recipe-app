import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  // Only used for uploading source maps at build time (readable stack
  // traces in Sentry instead of minified ones) — unset in an environment
  // without SENTRY_AUTH_TOKEN, the build just skips that upload rather
  // than failing.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
