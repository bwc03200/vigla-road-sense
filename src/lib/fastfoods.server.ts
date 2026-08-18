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

/** Mirrors tried in order of preference. */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Per-mirror budget: fail fast instead of stalling the whole lookup. */
const MIRROR_TIMEOUT_MS = 15000;

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
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Grow the viewport a bit so POIs just off-screen are ready when panning. */
function pad(bbox: OverpassBBox): OverpassBBox {
  const dLat = (bbox.north - bbox.south) * 0.35;
  const dLon = (bbox.east - bbox.west) * 0.35;
  return {
    south: bbox.south - dLat,
    north: bbox.north + dLat,
    west: bbox.west - dLon,
    east: bbox.east + dLon,
  };
}

export async function queryFastfoods(raw: OverpassBBox): Promise<FastfoodResult> {
  const bbox = pad(raw);
  const area = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  // `nwr` + `out center`: outside dense city centres the brands are mapped as
  // building polygons (ways/relations), not nodes — a node-only query misses them.
  const q =
    `[out:json][timeout:25];(` +
    `nwr["amenity"~"fast_food|restaurant"]["name"~"${BRAND_RE}",i](${area});` +
    `nwr["amenity"~"fast_food|restaurant"]["brand"~"${BRAND_RE}",i](${area});` +
    `);out center qt 400;`;

  const started = Date.now();
  const failures: string[] = [];
  let lastHost = "";

  for (const url of ENDPOINTS) {
    lastHost = new URL(url).host;
    try {
      // POST with a form body: overpass-api.de answers 406 to the GET form of
      // this brand-regex query, while every mirror accepts the POST form.
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: q }),
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as { elements?: OverpassElement[] };
      const seen = new Set<string>();
      const data: FastfoodPOI[] = (json.elements ?? [])
        .map((e) => {
          const tags = e.tags ?? {};
          const lat = e.lat ?? e.center?.lat;
          const lon = e.lon ?? e.center?.lon;
          const name = tags["name"] ?? tags["brand"] ?? "";
          return {
            id: `ff-${e.type ?? "n"}-${e.id}`,
            latitude: lat as number,
            longitude: lon as number,
            name,
            brand: normaliseBrand(`${tags["brand"] ?? ""} ${name}`),
            amenity: tags["amenity"] ?? "fast_food",
          };
        })
        .filter(
          (p) =>
            Number.isFinite(p.latitude) &&
            Number.isFinite(p.longitude) &&
            p.brand !== "other" &&
            !seen.has(p.id) &&
            seen.add(p.id) !== undefined,
        );

      console.log(`🍔 [SERVER] ${area} → ${data.length} POIs via ${lastHost}`);
      return { ok: true, data, fetchTime: Date.now() - started };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`🍔 [SERVER] mirror ${lastHost} failed: ${msg}`);
      failures.push(`${lastHost}: ${msg}`);
    }
  }


  return {
    ok: false,
    error: `overpass unreachable — ${failures.join(" | ")}`,
    failedMirror: lastHost,
  };
}

/**
 * Thin wrapper that queries Overpass directly (single mirror, 5 s timeout).
 * Returns an empty array on failure so callers stay resilient.
 */
export async function fetchOverpassRestaurants(bbox: OverpassBBox): Promise<FastfoodPOI[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const area = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const q =
      `[out:json][timeout:25];(` +
      `nwr["amenity"~"fast_food|restaurant"]["name"~"${BRAND_RE}",i](${area});` +
      `nwr["amenity"~"fast_food|restaurant"]["brand"~"${BRAND_RE}",i](${area});` +
      `);out center qt 400;`;

    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "VIGLA/1.0 (fastfoods; https://vigla-road-sense.lovable.app)",
          Accept: "application/json",
        },
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("❌ [OVERPASS ERROR]", response.status);
      return [];
    }

    const json = (await response.json()) as { elements?: OverpassElement[] };
    const seen = new Set<string>();
    return (json.elements ?? [])
      .map((e) => {
        const tags = e.tags ?? {};
        const lat = e.lat ?? e.center?.lat;
        const lon = e.lon ?? e.center?.lon;
        const name = tags["name"] ?? tags["brand"] ?? "";
        return {
          id: `ff-${e.type ?? "n"}-${e.id}`,
          latitude: lat as number,
          longitude: lon as number,
          name,
          brand: normaliseBrand(`${tags["brand"] ?? ""} ${name}`),
          amenity: tags["amenity"] ?? "fast_food",
        };
      })
      .filter(
        (p) =>
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude) &&
          p.brand !== "other" &&
          !seen.has(p.id) &&
          seen.add(p.id) !== undefined,
      );
  } catch (err) {
    console.error("❌ [OVERPASS TIMEOUT]", err);
    clearTimeout(timeoutId);
    return [];
  }
}
