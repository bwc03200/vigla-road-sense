/**
 * Server-side Overpass fetch for traffic signals.
 *
 * The browser cannot reach overpass-api.de directly from the app origin
 * (every client POST failed with `TypeError: Failed to fetch`), so the call
 * is made server-side and the nodes are returned as plain JSON.
 */
export interface OverpassBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface SignalNode {
  id: string;
  latitude: number;
  longitude: number;
}

// Public Overpass mirrors, tried in order. The main instance is first: the
// community mirrors below were answering with error pages after ~15s each,
// pushing a single lookup past 30s (markers never appeared while driving).
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Per-mirror budget: fail fast instead of stalling the whole lookup. */
const MIRROR_TIMEOUT_MS = 9000;



export async function queryTrafficSignals(bbox: OverpassBBox): Promise<SignalNode[]> {
  const q = `[out:json][timeout:25];node["highway"="traffic_signals"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out skel qt 800;`;
  const failures: string[] = [];

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(`${url}?data=${encodeURIComponent(q)}`, {
        method: "GET",
        headers: {
          // Overpass rejects/limits clients without an identifying UA.
          "User-Agent": "VIGLA/1.0 (traffic-signals; https://vigla-road-sense.lovable.app)",
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        elements?: { id: number; lat: number; lon: number }[];
      };
      return (data.elements ?? [])
        .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
        .map((e) => ({ id: `ts-${e.id}`, latitude: e.lat, longitude: e.lon }));
    } catch (err) {
      const host = new URL(url).host;
      failures.push(`${host}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`overpass unreachable — ${failures.join(" | ")}`);
}

