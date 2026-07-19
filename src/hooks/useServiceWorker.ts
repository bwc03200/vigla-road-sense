import { useEffect } from "react";

/**
 * Registers the app's service worker (/sw.js) once at startup, independently
 * of push-notification opt-in. Enables tile caching for every user.
 *
 * Silent no-op when serviceWorker API is unavailable or registration fails.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    (async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration("/sw.js");
        if (cancelled) return;
        if (existing) return;
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Silently ignore — unsupported browser, insecure context, etc.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
