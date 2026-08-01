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

// Public Overpass mirrors, tried in order: the main instance frequently
// answers 429/504 for shared server IPs.
const ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];


export async function queryTrafficSignals(bbox: OverpassBBox): Promise<SignalNode[]> {
  const q = `[out:json][timeout:25];node["highway"="traffic_signals"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out skel qt 800;`;
  let lastError: unknown = null;

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(q),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const data = (await res.json()) as {
        elements?: { id: number; lat: number; lon: number }[];
      };
      return (data.elements ?? [])
        .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
        .map((e) => ({ id: `ts-${e.id}`, latitude: e.lat, longitude: e.lon }));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("overpass unreachable");
}
