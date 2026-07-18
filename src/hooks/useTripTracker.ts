import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";

const MIN_DISTANCE_TO_PERSIST_M = 100;

/** Records a trip while position is being tracked. */
export function useTripTracker(userId: string | null) {
  const position = useVigla((s) => s.position);
  const tripIdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);
  const lastPointRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const distanceRef = useRef(0);
  const alertsRef = useRef(0);

  useEffect(() => {
    if (!userId || !position) return;
    let cancelled = false;

    const now = Date.now();
    const last = lastPointRef.current;

    if (!last) {
      lastPointRef.current = { lat: position.lat, lng: position.lng, t: now };
      return;
    }

    const d = haversine(last.lat, last.lng, position.lat, position.lng);
    if (d > 3) distanceRef.current += d;

    // Lazily create the trip row only once we've actually moved.
    if (
      !tripIdRef.current &&
      !creatingRef.current &&
      distanceRef.current >= MIN_DISTANCE_TO_PERSIST_M
    ) {
      creatingRef.current = true;
      supabase
        .from("trip_history")
        .insert({
          user_id: userId,
          distance_km: +(distanceRef.current / 1000).toFixed(3),
        })
        .select("id")
        .single()
        .then(({ data, error }) => {
          if (!cancelled && !error && data) tripIdRef.current = data.id;
          creatingRef.current = false;
        });
    }

    const sinceLastSaveMs = now - last.t;
    if (
      tripIdRef.current &&
      (distanceRef.current > 500 || sinceLastSaveMs > 60000)
    ) {
      supabase
        .from("trip_history")
        .update({
          distance_km: +(distanceRef.current / 1000).toFixed(3),
          alerts_received: alertsRef.current,
        })
        .eq("id", tripIdRef.current)
        .then(() => {});
      lastPointRef.current = { lat: position.lat, lng: position.lng, t: now };
    } else {
      lastPointRef.current = {
        lat: position.lat,
        lng: position.lng,
        t: last.t,
      };
    }

    return () => {
      cancelled = true;
    };
  }, [userId, position]);

  return {
    incrementAlerts: () => {
      alertsRef.current += 1;
    },
  };
}
