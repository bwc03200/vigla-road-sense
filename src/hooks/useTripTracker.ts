import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";

/** Records a trip while position is being tracked. */
export function useTripTracker(userId: string | null) {
  const position = useVigla((s) => s.position);
  const tripIdRef = useRef<string | null>(null);
  const lastPointRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const distanceRef = useRef(0);
  const alertsRef = useRef(0);

  useEffect(() => {
    if (!userId || !position) return;
    let cancelled = false;

    async function ensureTrip() {
      if (tripIdRef.current) return;
      const { data, error } = await supabase
        .from("trip_history")
        .insert({ user_id: userId })
        .select("id")
        .single();
      if (!cancelled && !error && data) tripIdRef.current = data.id;
    }
    ensureTrip();

    const now = Date.now();
    const last = lastPointRef.current;
    if (last) {
      const d = haversine(last.lat, last.lng, position.lat, position.lng);
      if (d > 3) distanceRef.current += d;
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
    } else {
      lastPointRef.current = { lat: position.lat, lng: position.lng, t: now };
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
