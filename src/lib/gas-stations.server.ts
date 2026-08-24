import { raceOverpassMirrors } from "./overpass-race.server";
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

  // All mirrors are queried in parallel; the first usable answer wins.
  const { json } = await raceOverpassMirrors({
    endpoints: ENDPOINTS,
    query: q,
    timeoutMs: MIRROR_TIMEOUT_MS,
    label: "ESSENCE MIRROR",
  });

  const elements = (json.elements ?? []) as {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }[];

  return elements
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
}

