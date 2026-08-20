import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";
import { fetchGasStations, loadCachedGasStations, type FuelBBox } from "@/lib/gas-stations";

/** Below this zoom we don't query Overpass for fuel stations. */
export const MIN_ZOOM_FOR_GAS_STATIONS = 12;

/**
 * Keeps `gasStations` in the store in sync with the visible map area.
 * Purely additive: no routing / navigation logic depends on it.
 */
export function useGasStations(bbox: FuelBBox | null, zoom: number, enabled: boolean) {
  const setGasStations = useVigla((s) => s.setGasStations);

  useEffect(() => {
    const cached = loadCachedGasStations();
    if (cached?.stations?.length) setGasStations(cached.stations);
  }, [setGasStations]);

  const latest = useRef({ bbox, zoom, enabled });
  latest.current = { bbox, zoom, enabled };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const { bbox: b, zoom: z, enabled: on } = latest.current;
      if (!on || !b || z < MIN_ZOOM_FOR_GAS_STATIONS) return;
      const rows = await fetchGasStations(b);
      if (!cancelled && rows) setGasStations(rows);
    };
    void tick();
    const timer = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setGasStations]);
}
