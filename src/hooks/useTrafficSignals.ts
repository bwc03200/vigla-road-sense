import { useEffect, useRef } from "react";
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

  // Latest viewport kept in a ref: a moving GPS position changes `bbox` every
  // second, and restarting a debounce timer on each change meant the fetch
  // never fired while driving (signals only loaded on a perfectly still map).
  const latest = useRef({ bbox, zoom, enabled });
  latest.current = { bbox, zoom, enabled };

  useEffect(() => {
    let cancelled = false;
    // Single long-lived poller: it always reads the *current* bbox, so panning
    // to any new area (Lyon, Marseille, rural) triggers a fresh Overpass query
    // as soon as the throttle window allows. fetchTrafficSignals() itself
    // skips already-covered areas, so this is cheap.
    const timer = window.setInterval(async () => {
      const { bbox: b, zoom: z, enabled: on } = latest.current;
      if (!on || !b || z < MIN_ZOOM_FOR_SIGNALS) return;
      const rows = await fetchTrafficSignals(b);
      if (!cancelled && rows) setTrafficSignals(rows);
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setTrafficSignals]);

}
