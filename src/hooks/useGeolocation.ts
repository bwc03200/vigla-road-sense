import { useEffect } from "react";
import { useVigla } from "@/lib/vigla-store";
import { logError, logEvent } from "@/lib/logger";

/**
 * Centralised, context-aware GPS watcher.
 *
 * Exactly ONE navigator.geolocation.watchPosition is active at any time.
 * The watch is torn down and restarted whenever the "context" changes, using
 * options tuned to the current use-case to save battery.
 *
 * Thresholds (tweak in one place):
 *
 * | Context                                    | high-accuracy | maximumAge |
 * |--------------------------------------------|---------------|------------|
 * | Active navigation (turn-by-turn)           | true          | 0 ms       |
 * | Convoy sharing OR crash detection armed    | true          | 2000 ms    |
 * | Foreground, just browsing the map          | false         | 10_000 ms  |
 * | Tab hidden AND no safety context active    | (paused)      | –          |
 * | Tab hidden but convoy/crash active         | false         | 30_000 ms  |
 */

type Profile =
  | { paused: true }
  | { paused: false; enableHighAccuracy: boolean; maximumAge: number; timeout: number };

function pickProfile(opts: {
  navActive: boolean;
  safetyActive: boolean; // convoy sharing OR crash detection armed
  hidden: boolean;
}): Profile {
  const { navActive, safetyActive, hidden } = opts;

  if (hidden) {
    if (!safetyActive && !navActive) return { paused: true };
    // Background but must keep some fix for convoy / crash.
    return { paused: false, enableHighAccuracy: false, maximumAge: 30_000, timeout: 45_000 };
  }
  if (navActive) {
    return { paused: false, enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 };
  }
  if (safetyActive) {
    return { paused: false, enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 };
  }
  // Idle map view — coarse, slow, cheap.
  return { paused: false, enableHighAccuracy: false, maximumAge: 10_000, timeout: 30_000 };
}

function profileKey(p: Profile): string {
  if (p.paused) return "paused";
  return `${p.enableHighAccuracy ? "hi" : "lo"}:${p.maximumAge}`;
}

export function useGeolocation() {
  const setPosition = useVigla((s) => s.setPosition);
  const setGeoError = useVigla((s) => s.setGeoError);

  const navActive = useVigla(
    (s) => !!s.navigation && !s.navigation.arrived,
  );
  const safetyActive = useVigla(
    (s) => !!s.convoy || s.crashDetectionEnabled,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setGeoError("unsupported");
      return;
    }

    let watchId: number | null = null;
    let currentKey = "";
    let fixCount = 0;
    let windowStart = Date.now();

    const start = () => {
      const hidden =
        typeof document !== "undefined" && document.visibilityState === "hidden";
      const profile = pickProfile({ navActive, safetyActive, hidden });
      const key = profileKey(profile);
      if (key === currentKey) return;
      currentKey = key;

      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (profile.paused) {
        logEvent("gps.watch.paused", "info");
        return;
      }
      logEvent("gps.watch.start", "info", {
        highAccuracy: profile.enableHighAccuracy,
        maximumAge: profile.maximumAge,
      });

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGeoError(null);
          setPosition(
            {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading ?? null,
              timestamp: pos.timestamp,
            },
            pos.coords.speed,
          );
          fixCount += 1;
          // Emit a rate metric once per minute so we can verify battery gains.
          const now = Date.now();
          if (now - windowStart > 60_000) {
            logEvent(
              "gps.fix.rate",
              "info",
              { fixes: fixCount, seconds: Math.round((now - windowStart) / 1000), profile: key },
              // Dedupe per profile+minute bucket so we don't spam.
              `gps.fix.rate:${key}:${Math.floor(now / 60_000)}`,
            );
            fixCount = 0;
            windowStart = now;
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setGeoError("denied");
          else if (err.code === err.POSITION_UNAVAILABLE) setGeoError("unavailable");
          else setGeoError("timeout");
          logError(err, { source: "geolocation.watchPosition", code: err.code }, `gps.err.${err.code}`);
        },
        {
          enableHighAccuracy: profile.enableHighAccuracy,
          maximumAge: profile.maximumAge,
          timeout: profile.timeout,
        },
      );
    };

    start();
    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [navActive, safetyActive, setPosition, setGeoError]);
}
