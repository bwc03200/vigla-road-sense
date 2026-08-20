import { logError, logEvent } from "@/lib/logger";
import { getGasStations } from "@/lib/gas-stations.functions";
import type { GasStation } from "@/types/vigla";

const CACHE_KEY = "vigla:gas-stations-cache";
const MIN_INTERVAL_MS = 6000;

export interface FuelBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface CacheShape {
  bbox: FuelBBox;
  fetchedAt: number;
  stations: GasStation[];
}

let lastRequestAt = 0;
let lastBBox: FuelBBox | null = null;
let inFlight = false;

export function loadCachedGasStations(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch {
    return null;
  }
}

function covers(outer: FuelBBox | null, inner: FuelBBox): boolean {
  if (!outer) return false;
  return (
    outer.south <= inner.south &&
    outer.north >= inner.north &&
    outer.west <= inner.west &&
    outer.east >= inner.east
  );
}

/** Throttled Overpass fetch for amenity=fuel POIs inside `bbox`. */
export async function fetchGasStations(bbox: FuelBBox): Promise<GasStation[] | null> {
  if (inFlight) return null;
  if (covers(lastBBox, bbox)) return loadCachedGasStations()?.stations ?? [];
  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) return null;

  lastRequestAt = now;
  inFlight = true;
  try {
    const res = await getGasStations({ data: bbox });
    if (!res.ok) throw new Error(res.error);
    const stations: GasStation[] = res.stations;
    lastBBox = bbox;
    logEvent("gas-stations: fetched", "info", { count: stations.length }, "fuel-ok");
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ bbox, fetchedAt: Date.now(), stations } satisfies CacheShape),
      );
    } catch {
      /* quota */
    }
    return stations;
  } catch (err) {
    lastRequestAt = 0;
    logError(err, { scope: "overpass-gas-stations" }, "fuel-fail");
    return null;
  } finally {
    inFlight = false;
  }
}
