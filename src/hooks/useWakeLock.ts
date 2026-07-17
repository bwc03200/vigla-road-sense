import { useEffect, useRef } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

/**
 * Keeps the screen awake while `active` is true, via the Screen Wake Lock API.
 * Reacquires the lock automatically when the tab returns to the foreground.
 * Silently no-ops on browsers without support.
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    if (!wakeLock || typeof wakeLock.request !== "function") return;

    let cancelled = false;

    const request = async () => {
      if (!active || cancelled) return;
      try {
        const sentinel = await wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Ignore — user gesture may be missing or feature disabled.
      }
    };

    const release = () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) s.release().catch(() => undefined);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && active && !sentinelRef.current) {
        void request();
      }
    };

    if (active) {
      void request();
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [active]);
}
