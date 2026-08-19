/**
 * Server-side Overpass fetch for restaurant / food POIs.
 *
 * The browser cannot reach the Overpass mirrors directly from the app origin,
 * so the query runs server-side and returns plain JSON. Never throws — callers
 * get a structured result.
 *
 * The query is intentionally exhaustive: chains AND independents (kebabs,
 * pizzerias, crêperies, cafés, pubs, bars serving food) so the chip appears in
 * every commune that has at least one place to eat.
 */
export interface OverpassBBox {
  south: number;
  west: number;
  north: number;
  east: number;
  /** Current map zoom (0-20) — drives the search radius. */
  zoom?: number;
}

export interface FastfoodPOI {
  id: string;
  latitude: number;
  longitude: number;
  /** Display name (OSM `name`, falling back to `brand` / cuisine). */
  name: string;
  /** Normalised brand key: mcdonalds | kfc | burger_king | subway | quick | other. */
  brand: string;
  /** Raw OSM amenity value (fast_food | restaurant | cafe | pub | bar). */
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
  "https://overpass.osm.jp/api/interpreter",
];

/**
 * Overpass mirrors answer 406 when the request looks like a bot (no UA /
 * no Accept). Sending a descriptive UA + explicit form content type is what
 * makes overpass-api.de accept the POST.
 */
const OVERPASS_HEADERS: Record<string, string> = {
  // Keep this short: overpass-api.de answers 406 for UA strings containing a URL.
  "User-Agent": "VIGLA/1.0",
  Accept: "application/json",
  "Content-Type": "application/x-www-form-urlencoded",
};

/** Per-mirror budget: fail fast instead of stalling the whole lookup. */
const MIRROR_TIMEOUT_MS = 15000;

const BRAND_RE = "McDonald's|KFC|Burger King|Subway|Quick";
const AMENITY_RE = "restaurant|fast_food|cafe|pub|bar";

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

/**
 * Search radius (degrees) by zoom: ±10° at z0 → ±0.0001° at z20.
 * r(z) = 10^(1 - 0.25z)
 */
export function radiusForZoom(zoom: number): number {
  const z = Math.min(20, Math.max(0, zoom));
  return Math.pow(10, 1 - 0.25 * z);
}

/**
 * Grow the viewport so POIs just off-screen are ready when panning, and make
 * sure the searched box is at least the zoom-scaled radius (a tiny viewport in
 * a small commune must still reach the village centre).
 */
function pad(bbox: OverpassBBox): OverpassBBox {
  const dLat = (bbox.north - bbox.south) * 0.35;
  const dLon = (bbox.east - bbox.west) * 0.35;
  let out = {
    south: bbox.south - dLat,
    north: bbox.north + dLat,
    west: bbox.west - dLon,
    east: bbox.east + dLon,
  };

  if (typeof bbox.zoom === "number") {
    // Keep Overpass sane: never search a box wider than ~1.5° from a viewport.
    const r = Math.min(1.5, Math.max(radiusForZoom(bbox.zoom), 0.02));
    const cLat = (bbox.south + bbox.north) / 2;
    const cLon = (bbox.west + bbox.east) / 2;
    out = {
      south: Math.min(out.south, cLat - r),
      north: Math.max(out.north, cLat + r),
      west: Math.min(out.west, cLon - r),
      east: Math.max(out.east, cLon + r),
    };
    console.log("🍔 [SEARCH_BBOX_BY_ZOOM]", { zoom: bbox.zoom, radius: r, bbox: out });
  }

  return out;
}

function toPOI(e: OverpassElement): FastfoodPOI {
  const tags = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  const cuisine = tags["cuisine"]?.split(";")[0]?.replace(/_/g, " ");
  const name =
    tags["name"] ??
    tags["brand"] ??
    tags["operator"] ??
    (cuisine ? cuisine.replace(/^./, (c) => c.toUpperCase()) : "Restaurant");
  return {
    id: `ff-${e.type ?? "n"}-${e.id}`,
    latitude: lat as number,
    longitude: lon as number,
    name,
    brand: normaliseBrand(`${tags["brand"] ?? ""} ${tags["name"] ?? ""}`),
    amenity: tags["amenity"] ?? "restaurant",
  };
}

export async function queryFastfoods(raw: OverpassBBox): Promise<FastfoodResult> {
  const bbox = pad(raw);
  const area = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  // `nwr` + `out center`: outside dense city centres places are mapped as
  // building polygons (ways/relations), not nodes — a node-only query misses them.
  const q =
    `[out:json][timeout:25];(` +
    `nwr["amenity"~"${AMENITY_RE}"](${area});` +
    `nwr["cuisine"](${area});` +
    `);out center qt 600;`;
  console.log("🍔 [OVERPASS_QUERY]", q);

  const started = Date.now();
  const failures: string[] = [];
  let lastHost = "";

  for (const url of ENDPOINTS) {
    lastHost = new URL(url).host;
    console.log("🍔 [MIRROR] trying", lastHost);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: OVERPASS_HEADERS,
        body: new URLSearchParams({ data: q }).toString(),
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as { elements?: OverpassElement[] };
      const seen = new Set<string>();
      const data: FastfoodPOI[] = (json.elements ?? [])
        .map(toPOI)
        .filter(
          (p) =>
            Number.isFinite(p.latitude) &&
            Number.isFinite(p.longitude) &&
            !seen.has(p.id) &&
            seen.add(p.id) !== undefined,
        );

      console.log("🍔 [RESTAURANTS_FOUND]", {
        mirror: lastHost,
        area,
        count: data.length,
        ms: Date.now() - started,
      });
      if (data.length === 0) {
        // Nothing here through this mirror — try the next one before giving up.
        failures.push(`${lastHost}: 0 results`);
        continue;
      }
      return { ok: true, data, fetchTime: Date.now() - started };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`🍔 [MIRROR] ${lastHost} failed: ${msg}`);
      failures.push(`${lastHost}: ${msg}`);
    }
  }

  // Every Overpass mirror is down, rate-limiting, or empty: fall back to
  // Nominatim, which serves the same OSM data through a different endpoint.
  const fallback = await nominatimFallback(bbox);
  if (fallback.length) {
    console.log("🍔 [RESTAURANTS_FOUND] nominatim fallback", fallback.length);
    return { ok: true, data: fallback, fetchTime: Date.now() - started };
  }

  return {
    ok: false,
    error: `overpass unreachable — ${failures.join(" | ")}`,
    failedMirror: lastHost,
  };
}

const NOMINATIM_QUERIES = [
  "restaurant",
  "fast food",
  "kebab",
  "pizzeria",
  "café",
  "McDonald's",
  "Burger King",
];

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  place_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  type?: string;
}

async function nominatimFallback(bbox: OverpassBBox): Promise<FastfoodPOI[]> {
  const out: FastfoodPOI[] = [];
  const seen = new Set<string>();
  const viewbox = `${bbox.west},${bbox.north},${bbox.east},${bbox.south}`;

  for (const term of NOMINATIM_QUERIES) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: term,
          format: "json",
          limit: "20",
          viewbox,
          bounded: "1",
        }).toString();
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "VIGLA/1.0 (contact: vigla-road-sense.lovable.app)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const places = (await res.json()) as NominatimPlace[];
      for (const p of places) {
        const lat = Number(p.lat);
        const lon = Number(p.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const id = `ff-${p.osm_type?.[0] ?? "n"}-${p.osm_id ?? p.place_id}`;
        if (seen.has(id)) continue;
        const name = p.name ?? p.display_name?.split(",")[0] ?? term;
        seen.add(id);
        out.push({
          id,
          latitude: lat,
          longitude: lon,
          name,
          brand: normaliseBrand(name),
          amenity: p.type ?? "restaurant",
        });
      }
    } catch (err) {
      console.warn(`🍔 [MIRROR] nominatim "${term}" failed:`, err);
    }
  }

  return out;
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
      `nwr["amenity"~"${AMENITY_RE}"](${area});` +
      `nwr["cuisine"](${area});` +
      `);out center qt 600;`;

    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "VIGLA/1.0",
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
      .map(toPOI)
      .filter(
        (p) =>
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude) &&
          !seen.has(p.id) &&
          seen.add(p.id) !== undefined,
      );
  } catch (err) {
    console.error("❌ [OVERPASS TIMEOUT]", err);
    clearTimeout(timeoutId);
    return [];
  }
}

// Keep the brand regex referenced for future brand-only queries.
export const FASTFOOD_BRAND_RE = BRAND_RE;
