import type { TrafficSignal } from "@/types/vigla";
import { logError, logEvent } from "@/lib/logger";
import { getTrafficSignals } from "@/lib/traffic-signals.functions";

const CACHE_KEY = "vigla:traffic-signals-cache";
const MIN_INTERVAL_MS = 6000; // Overpass public API is rate-limited.


export interface SignalBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface CacheShape {
  bbox: SignalBBox;
  fetchedAt: number;
  signals: TrafficSignal[];
}

let lastRequestAt = 0;
let lastBBox: SignalBBox | null = null;
let inFlight = false;

export function loadCachedSignals(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch {
    return null;
  }
}

/** true when `inner` is fully covered by `outer` (no refetch needed). */
export function bboxCovers(outer: SignalBBox | null, inner: SignalBBox): boolean {
  if (!outer) return false;
  return (
    outer.south <= inner.south &&
    outer.north >= inner.north &&
    outer.west <= inner.west &&
    outer.east >= inner.east
  );
}

/**
 * Fetch highway=traffic_signals nodes inside `bbox` from Overpass.
 * Throttled (min 6s between calls) and skipped entirely when the requested
 * area is already covered by the previous fetch. Results are cached in
 * localStorage so a reload / offline session keeps the last known signals.
 */
export async function fetchTrafficSignals(
  bbox: SignalBBox,
): Promise<TrafficSignal[] | null> {
  if (inFlight) return null;
  // Already covered: serve the cached rows so callers stop retrying.
  if (bboxCovers(lastBBox, bbox)) return loadCachedSignals()?.signals ?? [];
  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) return null;

  lastRequestAt = now;
  inFlight = true;
  logEvent("traffic-signals: request", "info", { bbox }, "traffic-signals-req");
  try {
    // Routed through a server function: direct browser calls to Overpass are
    // blocked from the app origin (`TypeError: Failed to fetch`).
    const res = await getTrafficSignals({ data: bbox });
    if (!res.ok) throw new Error(res.error);
    const signals: TrafficSignal[] = res.signals;
    lastBBox = bbox;
    logEvent(
      "traffic-signals: fetched",
      "info",
      { count: signals.length },
      "traffic-signals-ok",
    );
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ bbox, fetchedAt: Date.now(), signals } satisfies CacheShape),
      );
    } catch {
      /* quota */
    }
    return signals;
  } catch (err) {
    // A failed attempt must not lock the throttle window.
    lastRequestAt = 0;
    logError(err, { scope: "overpass-traffic-signals" }, "traffic-signals-fail");
    return null;
  } finally {
    inFlight = false;
  }

}

