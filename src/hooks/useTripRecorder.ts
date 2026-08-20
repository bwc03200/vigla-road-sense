import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVigla } from "@/lib/vigla-store";
import { saveTrip } from "@/lib/trip-history";

/**
 * Saves a trip into the local history each time a new route is computed
 * (i.e. whenever the user taps "Y aller" / starts a route).
 */
export function useTripRecorder(userId: string | null) {
  const { t } = useTranslation();
  const route = useVigla((s) => s.route);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (!route) {
      lastKeyRef.current = null;
      return;
    }
    const key = `${route.destination.lat.toFixed(5)},${route.destination.lng.toFixed(5)}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const position = useVigla.getState().position;
    saveTrip(userId, {
      startName: t("tripHistory.myPosition"),
      startLat: position?.lat ?? route.coords[0]?.[0] ?? route.destination.lat,
      startLng: position?.lng ?? route.coords[0]?.[1] ?? route.destination.lng,
      endName: route.destination.label,
      endLat: route.destination.lat,
      endLng: route.destination.lng,
      distanceM: route.distanceM,
      durationS: route.durationS,
    });
  }, [route, userId, t]);
}
