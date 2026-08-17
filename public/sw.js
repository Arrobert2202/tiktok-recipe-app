/**
 * Minimal service worker.
 *
 * Its only job is to exist: Chrome requires a registered service worker before
 * it will offer the install prompt, which is what puts RecipeApp in the Android
 * share sheet.
 *
 * It deliberately caches nothing. Every page here is server-rendered against
 * live data (credits, cookbook, session), so a stale cached HTML document or
 * API response would be a much worse bug than a missing install prompt. There
 * is no fetch handler at all, so requests go straight to the network exactly as
 * they would with no service worker installed.
 */

self.addEventListener("install", () => {
  // Take over immediately instead of waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
