import { useEffect } from "react";
import { useVigla } from "@/lib/vigla-store";
import {
  fetchTrafficSignals,
  loadCachedSignals,
  type SignalBBox,
} from "@/lib/traffic-signals";

/**
 * Zoom threshold below which we don't query Overpass at all.
 * 13 (not 15): the map's default/idle zoom sits below 15, so signals never
 * loaded until the user manually zoomed in twice. Clustering keeps the
 * marker count manageable at these wider zooms.
 */
export const MIN_ZOOM_FOR_SIGNALS = 13;

/**
 * Keeps `trafficSignals` in the store in sync with the visible map area.
 * Overpass calls are throttled + skipped when the current bbox is already
 * covered (see src/lib/traffic-signals.ts). Purely additive: no routing,
 * GPS or navigation logic depends on this.
 */
export function useTrafficSignals(
  bbox: SignalBBox | null,
  zoom: number,
  enabled: boolean,
) {
  const setTrafficSignals = useVigla((s) => s.setTrafficSignals);

  // Hydrate from cache once so the map isn't empty right after load/offline.
  useEffect(() => {
    const cached = loadCachedSignals();
    if (cached?.signals?.length) setTrafficSignals(cached.signals);
  }, [setTrafficSignals]);

  useEffect(() => {
    if (!enabled || !bbox || zoom < MIN_ZOOM_FOR_SIGNALS) return;
    let cancelled = false;
    let timer = 0;

    // Poll until we actually get rows: fetchTrafficSignals returns null when
    // throttled or already covered, and the previous one-shot debounce meant a
    // single throttled attempt (very common while the map recenters) left the
    // layer permanently empty. We never abort the request — an aborted fetch
    // wastes the Overpass quota and returns nothing.
    const attempt = async () => {
      const rows = await fetchTrafficSignals(bbox);
      if (cancelled) return;
      if (rows) {
        setTrafficSignals(rows);
        return;
      }
      timer = window.setTimeout(attempt, 3000);
    };
    timer = window.setTimeout(attempt, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bbox, zoom, enabled, setTrafficSignals]);

}
