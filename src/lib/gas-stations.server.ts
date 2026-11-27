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
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const MIRROR_TIMEOUT_MS = 4000;

const NOMINATIM_FUEL_TERMS = ["station essence", "station-service", "station service"];

/**
 * Same OSM data through Nominatim, used when every Overpass mirror is busy or
 * returns nothing — the restaurants layer already works this way, so the fuel
 * layer must not stay empty while the restaurants show.
 */
async function nominatimFuelFallback(bbox: FuelBBox): Promise<FuelNode[]> {
  const out: FuelNode[] = [];
  const seen = new Set<string>();
  const viewbox = `${bbox.west},${bbox.north},${bbox.east},${bbox.south}`;
  for (const term of NOMINATIM_FUEL_TERMS) {
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({ q: term, format: "json", limit: "30", viewbox, bounded: "1" }).toString();
      const res = await fetch(url, {
        headers: {
          "User-Agent": "VIGLA/1.0 (contact: vigla-road-sense.lovable.app)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const places = (await res.json()) as {
        lat: string;
        lon: string;
        osm_type?: string;
        osm_id?: number;
        place_id?: number;
        name?: string;
        display_name?: string;
      }[];
      for (const p of places) {
        const lat = Number(p.lat);
        const lon = Number(p.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const id = `fuel-${p.osm_type?.[0] ?? "n"}-${p.osm_id ?? p.place_id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const name = p.name || p.display_name?.split(",")[0] || null;
        out.push({ id, latitude: lat, longitude: lon, name, brand: name });
      }
    } catch (err) {
      console.warn(`⛽ [FUEL] nominatim "${term}" failed:`, err);
    }
    if (out.length >= 10) break;
  }
  return out;
}

export async function queryGasStations(bbox: FuelBBox): Promise<FuelNode[]> {
  const fromOverpass = await queryGasStationsOverpass(bbox).catch(() => [] as FuelNode[]);
  if (fromOverpass.length > 0) return fromOverpass;
  return nominatimFuelFallback(bbox);
}

async function queryGasStationsOverpass(bbox: FuelBBox): Promise<FuelNode[]> {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const q = `[out:json][timeout:25];(node["amenity"="fuel"](${b});way["amenity"="fuel"](${b});relation["amenity"="fuel"](${b}););out center 500;`;

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

