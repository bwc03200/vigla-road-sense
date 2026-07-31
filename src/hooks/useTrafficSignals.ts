import { useEffect } from "react";
import { useVigla } from "@/lib/vigla-store";
import {
  fetchTrafficSignals,
  loadCachedSignals,
  type SignalBBox,
} from "@/lib/traffic-signals";

/** Zoom threshold below which we don't query Overpass at all. */
export const MIN_ZOOM_FOR_SIGNALS = 15;

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
    const ctrl = new AbortController();
    let cancelled = false;
    // Small debounce so a pan gesture doesn't fire per moveend burst.
    const timer = window.setTimeout(async () => {
      const rows = await fetchTrafficSignals(bbox, ctrl.signal);
      if (!cancelled && rows) setTrafficSignals(rows);
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [bbox, zoom, enabled, setTrafficSignals]);
}
