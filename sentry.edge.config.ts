import * as Sentry from "@sentry/nextjs";

// Covers middleware.ts and any edge-runtime route handlers — a separate
// init from sentry.server.config.ts because the edge runtime can't use
// the Node-specific transport the server config relies on.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
