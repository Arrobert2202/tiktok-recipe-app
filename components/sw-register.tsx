"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js` so Chrome will offer the PWA install prompt.
 *
 * Registration is best effort. It fails on unsupported browsers, in private
 * modes, and on insecure origins, and none of that should surface to the user
 * or block anything — the app works identically without it.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Nothing to recover from; the app does not depend on the worker.
      });
    };

    // Registering after load keeps the worker off the critical path.
    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
