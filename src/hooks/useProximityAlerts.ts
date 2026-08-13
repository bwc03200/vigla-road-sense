import { useCallback, useEffect, useRef, useState } from "react";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";
import type { FastfoodPOI } from "@/types/fastfoods";

export const PROXIMITY_THRESHOLD_M = 300;
export const PROXIMITY_CHECK_MS = 2000;
export const PROXIMITY_DISMISS_MS = 3000;
/** Global anti-spam: at most one popup per 30 s. */
export const MIN_TIME_BETWEEN_ALERTS_MS = 30000;
/** Leaving this ring re-arms a POI that was already shown. */
const REARM_DISTANCE_M = 500;
/** Stop polling when the rider has not moved for a minute (battery). */
const STATIONARY_PAUSE_MS = 60000;
/** Don't re-alert for the same POI within this window. */
const REALERT_COOLDOWN_MS = 5 * 60 * 1000;

export interface ProximityAlert {
  poi: FastfoodPOI;
  distanceM: number;
  /** Bearing from the user to the POI, relative to current heading (deg). */
  relativeBearing: number;
  /** Rough drive time to the POI, in minutes (min. 1). */
  etaMin: number;
}


function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * During active navigation, polls every 2s for POIs within 300m of the live
 * GPS position and surfaces one alert at a time (auto-dismissed after 3.5s).
 */
export function useProximityAlerts(pois: FastfoodPOI[], enabled: boolean) {
  const [alert, setAlert] = useState<ProximityAlert | null>(null);
  const seenRef = useRef<Map<string, number>>(new Map());
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poisRef = useRef(pois);
  poisRef.current = pois;

  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(
    (reason: "auto" | "manual" | "added" = "manual") => {
      setAlert((current) => {
        if (current) {
          if (reason === "manual") {
            console.log(`🚫 [POI DISMISSED] ${current.poi.name}`);
          } else if (reason === "added") {
            console.log(`📍 [POI ADDED TO ROUTE] ${current.poi.name}`);
          }
        }
        return null;
      });
      clearTimer();
    },
    [clearTimer],
  );

  useEffect(() => {
    if (!enabled) {
      seenRef.current.clear();
      clearTimer();
      setAlert(null);
      console.log("🚫 [NAV MODE INACTIVE]");
      return;
    }
    console.log("✅ [NAV MODE ACTIVE]");

    const tick = () => {
      const position = useVigla.getState().position;
      if (!position) return;
      const now = Date.now();

      // Battery guard: pause proximity scanning when the rider hasn't moved
      // for a minute (speed ~0 and position unchanged).
      const movedM = lastPosRef.current
        ? haversine(lastPosRef.current.lat, lastPosRef.current.lng, position.lat, position.lng)
        : Infinity;
      if (movedM > 15) {
        lastPosRef.current = { lat: position.lat, lng: position.lng };
        lastMoveAtRef.current = now;
      } else if (now - lastMoveAtRef.current > STATIONARY_PAUSE_MS) {
        return;
      }

      let best: ProximityAlert | null = null;
      for (const poi of poisRef.current) {
        const d = haversine(position.lat, position.lng, poi.latitude, poi.longitude);
        if (!Number.isFinite(d)) continue;
        // Re-arm a POI once the rider has left the 500 m ring around it.
        if (d > REARM_DISTANCE_M) {
          seenRef.current.delete(poi.id);
          continue;
        }
        const last = seenRef.current.get(poi.id);
        if (last != null && now - last < REALERT_COOLDOWN_MS) continue;
        if (d > PROXIMITY_THRESHOLD_M) continue;
        const abs = bearing(position.lat, position.lng, poi.latitude, poi.longitude);
        const rel = (abs - (position.heading ?? 0) + 360) % 360;
        // POI already behind the rider: never alert.
        if (position.heading != null && rel > 110 && rel < 250) continue;
        if (!best || d < best.distanceM) {
          const speedKmh = Math.max(position.speed ?? 0, 20);
          best = {
            poi,
            distanceM: d,
            relativeBearing: rel,
            etaMin: Math.max(1, Math.round(d / 1000 / speedKmh * 60)),
          };
        }
      }

      if (!best) return;
      // Global anti-spam window.
      if (now - lastAlertAtRef.current < MIN_TIME_BETWEEN_ALERTS_MS) return;
      setAlert((current) => {
        if (current) return current;
        seenRef.current.set(best!.poi.id, now);
        lastAlertAtRef.current = now;
        console.log("🍔 [POI ALERT 300M]", {
          poi: best!.poi.name,
          distance: Math.round(best!.distanceM),
          time: now,
        });
        clearTimer();
        dismissTimerRef.current = setTimeout(
          () => setAlert(null),
          PROXIMITY_DISMISS_MS,
        );
        return best;
      });
    };


    tick();
    const id = setInterval(tick, PROXIMITY_CHECK_MS);
    return () => {
      clearInterval(id);
      clearTimer();
    };
  }, [enabled, clearTimer]);

  return { alert, dismiss };
}
