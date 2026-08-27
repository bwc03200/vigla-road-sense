import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVigla } from "@/lib/vigla-store";
import { saveTrip } from "@/lib/trip-history";
import { insertSavedTrip } from "@/lib/saved-trips";

/**
 * Saves a trip into the local history each time a new route is computed
 * (i.e. whenever the user taps "Y aller" / starts a route), and persists a
 * completed navigation into the backend trip history on arrival.
 */
export function useTripRecorder(userId: string | null) {
  const { t } = useTranslation();
  const route = useVigla((s) => s.route);
  const arrived = useVigla((s) => s.navigation?.arrived ?? false);
  const lastKeyRef = useRef<string | null>(null);
  const recordedRef = useRef<string | null>(null);

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

  // Persist a completed navigation (origin → waypoints → destination).
  useEffect(() => {
    if (!userId || !arrived || !route) return;
    const key = `${route.destination.lat.toFixed(5)},${route.destination.lng.toFixed(5)}`;
    if (recordedRef.current === key) return;
    recordedRef.current = key;

    const start = route.coords[0];
    void insertSavedTrip(userId, {
      startName: t("tripHistory.myPosition"),
      startLat: start?.[0] ?? route.destination.lat,
      startLng: start?.[1] ?? route.destination.lng,
      endName: route.destination.label,
      endLat: route.destination.lat,
      endLng: route.destination.lng,
      waypoints: (route.waypoints ?? [])
        .filter((w) => w.type !== "destination")
        .map((w) => ({ name: w.name, lat: w.lat, lon: w.lon })),
      distanceM: route.distanceM,
      durationS: route.durationS,
    });
  }, [arrived, route, userId, t]);
}
