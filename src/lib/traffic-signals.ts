import type { TrafficSignal } from "@/types/vigla";
import { logError, logEvent } from "@/lib/logger";

const CACHE_KEY = "vigla:traffic-signals-cache";
const MIN_INTERVAL_MS = 6000; // Overpass public API is rate-limited.
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

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
  signal?: AbortSignal,
): Promise<TrafficSignal[] | null> {
  if (inFlight) return null;
  if (bboxCovers(lastBBox, bbox)) return null;
  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) return null;

  lastRequestAt = now;
  inFlight = true;
  const q = `[out:json][timeout:25];node["highway"="traffic_signals"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out skel qt 800;`;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: "data=" + encodeURIComponent(q),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal,
    });
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    const data = (await res.json()) as {
      elements?: { id: number; lat: number; lon: number }[];
    };
    const signals: TrafficSignal[] = (data.elements ?? [])
      .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
      .map((e) => ({ id: `ts-${e.id}`, latitude: e.lat, longitude: e.lon }));
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
    // A failed/aborted attempt must not lock the throttle window, otherwise a
    // pan gesture (which aborts the in-flight request) blocks every retry.
    lastRequestAt = 0;
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      logError(err, { scope: "overpass-traffic-signals" }, "traffic-signals-fail");
    }
    return null;
  } finally {
    inFlight = false;
  }
}

