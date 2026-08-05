/**
 * Server-side Overpass fetch for fast-food / restaurant POIs (major brands).
 *
 * Same rationale as traffic-signals.server.ts: the browser cannot reach the
 * Overpass mirrors directly from the app origin, so the query runs server-side
 * and returns plain JSON. Never throws — callers get a structured result.
 */
export interface OverpassBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface FastfoodPOI {
  id: string;
  latitude: number;
  longitude: number;
  /** Display name (OSM `name`, falling back to `brand`). */
  name: string;
  /** Normalised brand key: mcdonalds | kfc | burger_king | subway | quick. */
  brand: string;
  /** Raw OSM amenity value (fast_food | restaurant). */
  amenity: string;
}

export type FastfoodResult =
  | { ok: true; data: FastfoodPOI[]; fetchTime: number }
  | { ok: false; error: string; failedMirror: string };

/** Mirrors tried in order of proven reliability. */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass-a.openstreetmap.fr/api/interpreter",
  "https://overpass-c.openstreetmap.fr/api/interpreter",
];

/** Per-mirror budget: fail fast instead of stalling the whole lookup. */
const MIRROR_TIMEOUT_MS = 9000;

const BRAND_RE = "McDonald's|KFC|Burger King|Subway|Quick";

/** Map a raw OSM name/brand to a stable brand key used by the UI. */
function normaliseBrand(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("mcdonald")) return "mcdonalds";
  if (s.includes("kfc")) return "kfc";
  if (s.includes("burger king")) return "burger_king";
  if (s.includes("subway")) return "subway";
  if (s.includes("quick")) return "quick";
  return "other";
}

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export async function queryFastfoods(bbox: OverpassBBox): Promise<FastfoodResult> {
  const area = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const q =
    `[out:json][timeout:25];` +
    `node["amenity"~"fast_food|restaurant"]["name"~"${BRAND_RE}",i](${area});` +
    `out body qt 400;`;

  const started = Date.now();
  const failures: string[] = [];
  let lastHost = "";

  for (const url of ENDPOINTS) {
    lastHost = new URL(url).host;
    try {
      const res = await fetch(`${url}?data=${encodeURIComponent(q)}`, {
        method: "GET",
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
        headers: {
          "User-Agent": "VIGLA/1.0 (fastfoods; https://vigla-road-sense.lovable.app)",
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as { elements?: OverpassElement[] };
      const data: FastfoodPOI[] = (json.elements ?? [])
        .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
        .map((e) => {
          const tags = e.tags ?? {};
          const name = tags["name"] ?? tags["brand"] ?? "";
          return {
            id: `ff-${e.id}`,
            latitude: e.lat,
            longitude: e.lon,
            name,
            brand: normaliseBrand(tags["brand"] ?? name),
            amenity: tags["amenity"] ?? "fast_food",
          };
        })
        .filter((p) => p.brand !== "other");

      return { ok: true, data, fetchTime: Date.now() - started };
    } catch (err) {
      failures.push(`${lastHost}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    ok: false,
    error: `overpass unreachable — ${failures.join(" | ")}`,
    failedMirror: lastHost,
  };
}
