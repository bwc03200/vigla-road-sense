/**
 * Server-side Overpass fetch for fuel stations (amenity=fuel).
 *
 * Same pattern as traffic-signals.server.ts: the browser can't reach
 * overpass-api.de directly from the app origin, so the query runs server-side.
 */
export interface FuelBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface FuelNode {
  id: string;
  latitude: number;
  longitude: number;
  name: string | null;
  brand: string | null;
}

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const MIRROR_TIMEOUT_MS = 9000;

export async function queryGasStations(bbox: FuelBBox): Promise<FuelNode[]> {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const q = `[out:json][timeout:25];(node["amenity"="fuel"](${b});way["amenity"="fuel"](${b});relation["amenity"="fuel"](${b}););out center 300;`;
  const failures: string[] = [];

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(`${url}?data=${encodeURIComponent(q)}`, {
        method: "GET",
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
        headers: { "User-Agent": "VIGLA/1.0", Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        elements?: {
          type: string;
          id: number;
          lat?: number;
          lon?: number;
          center?: { lat: number; lon: number };
          tags?: Record<string, string>;
        }[];
      };
      return (data.elements ?? [])
        .map((e) => {
          const lat = e.lat ?? e.center?.lat;
          const lon = e.lon ?? e.center?.lon;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          return {
            id: `fuel-${e.type}-${e.id}`,
            latitude: lat as number,
            longitude: lon as number,
            name: e.tags?.name ?? e.tags?.brand ?? null,
            brand: e.tags?.brand ?? null,
          } satisfies FuelNode;
        })
        .filter((x): x is FuelNode => x !== null);
    } catch (err) {
      const host = new URL(url).host;
      failures.push(`${host}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`overpass unreachable — ${failures.join(" | ")}`);
}
