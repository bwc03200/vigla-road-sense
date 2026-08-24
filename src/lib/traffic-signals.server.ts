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

  // All mirrors are queried in parallel; the first usable answer wins.
  const { json } = await raceOverpassMirrors({
    endpoints: ENDPOINTS,
    query: q,
    timeoutMs: MIRROR_TIMEOUT_MS,
    label: "FEUX MIRROR",
  });

  const elements = (json.elements ?? []) as { id: number; lat: number; lon: number }[];
  return elements
    .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
    .map((e) => ({ id: `ts-${e.id}`, latitude: e.lat, longitude: e.lon }));
}


