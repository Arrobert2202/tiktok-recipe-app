import * as Sentry from "@sentry/nextjs";

// Skips initialization entirely without a DSN, rather than failing — so
// local dev and any environment without SENTRY_DSN set keeps working
// exactly as it did before Sentry was added.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // 100% in development (there's no volume to worry about), a small
    // sample in production — full tracing on every request adds real
    // overhead and cost at any meaningful traffic level.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
