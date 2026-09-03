import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * P11-E — Fuel prices from the free public dataset
 * "prix-des-carburants-en-france-flux-instantane-v2" (data.economie.gouv.fr).
 *
 * Purely additive: nothing in navigation / routing depends on it. When the API
 * is unreachable we simply keep the last cache (or no price at all) and the UI
 * degrades gracefully to "prix non disponible".
 *
 * Performance strategy:
 * - Stations (Overpass) and prices (data.gouv) load in PARALLEL — separate
 *   hooks, no waiting on each other; a slow price API never blocks markers.
 * - localStorage cache per area cell, TTL 24h → 2nd visit on the same zone
 *   resolves in <100 ms.
 * - Adaptive timeout: ~2.5s in dense (urban) viewports, ~5s in rural ones.
 * - On timeout with no cache: graceful fallback toast "Tarifs indisponibles".
 */

const CACHE_PREFIX = "vigla_essence_cache_";
const LEGACY_CACHE_KEY = "vigla:fuel-prices-cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h MAX — never show stale fuel prices
const RADIUS_KM = 25;
const LIMIT = 300;
const API =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records";

export interface FuelBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface FuelPriceEntry {
  /** SIRET of the station (dataset primary id). */
  siret: string;
  lat: number;
  lng: number;
  name: string | null;
  sp95: number | null;
  gazole: number | null;
  updatedAt: number | null;
}

interface AreaCache {
  fetchedAt: number;
  entries: FuelPriceEntry[];
}

function cacheKeyFor(lat: number, lng: number): string {
  return `${CACHE_PREFIX}${lat}_${lng}`;
}

function readAreaCache(key: string): AreaCache | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AreaCache;
    if (!Array.isArray(parsed?.entries)) return null;
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAreaCache(key: string, entries: FuelPriceEntry[]) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ fetchedAt: Date.now(), entries } satisfies AreaCache),
    );
  } catch {
    /* quota */
  }
}

/**
 * Read a STALE cache (past TTL) as a graceful fallback.
 * Only used if both primary + fallback APIs fail completely.
 * Shows old prices over no prices.
 */
function readStaleAreaCache(key: string): AreaCache | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AreaCache;
    if (!Array.isArray(parsed?.entries) || parsed.entries.length === 0) return null;
    // DO NOT validate TTL here — return ANY cache, even if 30+ days old
    console.log(`⛽ [CACHE STALE HIT] Found ${parsed.entries.length} stale entries`);
    return parsed;
  } catch (e) {
    console.warn("⛽ [CACHE READ ERROR]:", e);
    return null;
  }
}

/** Last-known-good cache written by older versions — used as fallback only. */
function readLegacyCache(center: { lat: number; lng: number }): FuelPriceEntry[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      center?: { lat: number; lng: number };
      fetchedAt?: number;
      entries?: FuelPriceEntry[];
    };
    if (!parsed?.entries?.length || !parsed.center || !parsed.fetchedAt) return null;
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null;
    if (distanceM(parsed.center.lat, parsed.center.lng, center.lat, center.lng) > 15000)
      return null;
    return parsed.entries;
  } catch {
    return null;
  }
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Adaptive timeout from the visible bbox, tuned to match radar fetch
 * reactivity: 1.5s in dense urban viewports, 2.5s MAX in rural ones.
 * No endless waiting — popup prices appear in ~1-2s like other POI layers.
 */
function getAdaptiveTimeout(bbox: FuelBBox | null): number {
  // BASELINE: radars appear in ~1500 ms. Fuel prices must never feel slower.
  if (!bbox) return 1500;
  const area = Math.abs(bbox.north - bbox.south) * Math.abs(bbox.east - bbox.west);
  // < ~0.05°² ≈ zoomed-in city block level → dense; larger → rural
  const t = area < 0.05 ? 1500 : 2500;
  console.log(
    `⛽ [TIMEOUT BASELINE] Radars ~1500ms → gas timeout ${t}ms (${area < 0.05 ? "dense" : "rural"})`,
  );
  return t;
}

/**
 * TRUE second source — independent provider (api.prix-carburants.2aaz.fr),
 * a different host/infrastructure than data.economie.gouv.fr, so a platform
 * outage on the primary does not take the fallback down with it.
 */
const FALLBACK_API = "https://api.prix-carburants.2aaz.fr/stations/around";

interface FallbackFuel {
  name?: string;
  price?: number | string;
  update?: string;
}

interface FallbackRecord {
  id?: string | number;
  Latitude?: number | string;
  Longitude?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  Address?: { street_line?: string; city_line?: string } | null;
  Fuels?: FallbackFuel[] | null;
}

function fallbackToEntry(r: FallbackRecord): FuelPriceEntry | null {
  const lat = Number(r.Latitude ?? r.latitude);
  const lng = Number(r.Longitude ?? r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const fuels = r.Fuels ?? [];
  const pick = (needle: string) =>
    fuels.find((f) => (f.name ?? "").toLowerCase().includes(needle));
  const sp95 = pick("sp95") ?? pick("e10") ?? pick("95");
  const gazole = pick("gazole") ?? pick("diesel");
  const updated = ts(sp95?.update) ?? ts(gazole?.update);
  return {
    siret: String(r.id ?? `${lat},${lng}`),
    lat,
    lng,
    name:
      [r.Address?.street_line, r.Address?.city_line].filter(Boolean).join(", ") || null,
    sp95: num(sp95?.price),
    gazole: num(gazole?.price),
    updatedAt: updated,
  };
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ts(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

interface ApiRecord {
  id?: string | number;
  geom?: { lat?: number; lon?: number } | null;
  latitude?: number | string;
  longitude?: number | string;
  adresse?: string;
  ville?: string;
  gazole_prix?: number | string;
  gazole_maj?: string;
  sp95_prix?: number | string;
  sp95_maj?: string;
  e10_prix?: number | string;
  e10_maj?: string;
}

function toEntry(r: ApiRecord): FuelPriceEntry | null {
  const lat = r.geom?.lat ?? Number(r.latitude) / 100000;
  const lng = r.geom?.lon ?? Number(r.longitude) / 100000;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const sp95 = num(r.sp95_prix) ?? num(r.e10_prix);
  return {
    siret: String(r.id ?? `${lat},${lng}`),
    lat: lat as number,
    lng: lng as number,
    name: [r.adresse, r.ville].filter(Boolean).join(", ") || null,
    sp95,
    gazole: num(r.gazole_prix),
    updatedAt: ts(r.sp95_maj) ?? ts(r.e10_maj) ?? ts(r.gazole_maj),
  };
}

/**
 * Loads fuel prices around `center` (cached 24h per area cell) and exposes a
 * matcher resolving an Overpass fuel POI to its price record. Pass the current
 * `bbox` for an adaptive fetch timeout (2.5s dense / 5s rural).
 */
export function useGasStationPrices(
  center: { lat: number; lng: number } | null,
  enabled = true,
  bbox: FuelBBox | null = null,
) {
  const [entries, setEntries] = useState<FuelPriceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const requestedKeysRef = useRef<Set<string>>(new Set());
  const timedOutToastShownRef = useRef(false);
  // GPS ticks move the centre by centimetres; rounding to ~1 km keeps the
  // effect deps stable so we don't re-query the API on every position update.
  const keyLat = center ? Math.round(center.lat * 100) / 100 : null;
  const keyLng = center ? Math.round(center.lng * 100) / 100 : null;
  const timeoutMs = getAdaptiveTimeout(bbox);

  useEffect(() => {
    if (!enabled || keyLat === null || keyLng === null) return;
    const center = { lat: keyLat, lng: keyLng };
    const key = cacheKeyFor(keyLat, keyLng);

    // 1️⃣ CACHE FIRST (<100 ms on a revisited area)
    const cached = readAreaCache(key);
    if (cached) {
      setEntries(cached.entries);
      setFetchedAt(cached.fetchedAt);
      console.log("⛽ [CACHE HIT] Essence prices from localStorage", cached.entries.length);
      return;
    }
    // Legacy single-cell cache from older builds, still usable as fallback.
    const legacy = readLegacyCache(center);
    if (legacy) {
      setEntries(legacy);
    }

    // 2️⃣ Skip duplicate in-flight requests for the same cell; stations load
    // in parallel in their own hook, so prices never block markers.
    if (requestedKeysRef.current.has(key)) return;
    requestedKeysRef.current.add(key);

    const geomLiteral = `GEOM'POINT(${center.lng} ${center.lat})'`;
    const url =
      `${API}?limit=${LIMIT}&select=id,geom,adresse,ville,gazole_prix,gazole_maj,sp95_prix,sp95_maj,e10_prix,e10_maj` +
      `&where=${encodeURIComponent(
        `within_distance(geom, ${geomLiteral}, ${RADIUS_KM}km)`,
      )}` +
      `&order_by=${encodeURIComponent(`distance(geom, ${geomLiteral})`)}`;

    let cancelled = false;
    setLoading(true);
    console.log(
      "🟢 [API CALL: prix-carburants.gouv.fr]",
      RADIUS_KM,
      "km — timeout",
      timeoutMs,
      "ms",
    );

    // 3️⃣ ADAPTIVE TIMEOUT — no infinite waiting, UX stays fast everywhere.
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ results?: ApiRecord[] }>;
      })
      .then((data) => {
        if (cancelled) return null;
        const rows = (data.results ?? [])
          .map(toEntry)
          .filter((e): e is FuelPriceEntry => e !== null);
        if (rows.length === 0) throw new Error("empty primary response");
        console.log(
          "⛽ [ESSENCE FETCHED]",
          rows.length,
          "prices,",
          timeoutMs,
          "ms budget",
        );
        return rows;
      })
      .catch(async (primaryErr) => {
        // 3️⃣-bis FALLBACK SOURCE — legacy flux-instantané dataset (v1).
        if (cancelled) return null;
        console.log(
          "⛽ [P11-E] source primaire KO, essai fallback v1:",
          primaryErr instanceof DOMException && primaryErr.name === "AbortError"
            ? `timeout ${timeoutMs}ms`
            : String(primaryErr),
        );
        const fbUrl =
          `${FALLBACK_API}?limit=${LIMIT}` +
          `&where=${encodeURIComponent(
            `within_distance(geom, ${geomLiteral}, ${RADIUS_KM}km)`,
          )}`;
        try {
          const r = await fetch(fbUrl, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = (await r.json()) as { results?: FallbackRecord[] };
          const rows = (data.results ?? [])
            .map(fallbackToEntry)
            .filter((e): e is FuelPriceEntry => e !== null);
          if (rows.length === 0) return null;
          console.log("⛽ [ESSENCE FETCHED:FALLBACK v1]", rows.length, "prices");
          return rows;
        } catch (fbErr) {
          console.log("⛽ [P11-E] fallback v1 KO:", String(fbErr));
          return null;
        }
      })
      .then((rows) => {
        if (cancelled) return;
        if (rows !== null) {
          setEntries(rows);
          setFetchedAt(Date.now());
          // 4️⃣ CACHE RESULT (24h) — 2nd visit on the same zone is instant.
          writeAreaCache(key, rows);
          return;
        }
        requestedKeysRef.current.delete(key);
        console.log("⛽ [P11-E] prix indisponibles (primaire + fallback KO)");
        // 5️⃣ GRACEFUL FALLBACK — keep whatever cache we showed; otherwise
        // reuse a STALE cache (past TTL) before ever showing "indisponibles".
        const stale = readStaleAreaCache(key);
        if (stale) {
          console.log("⛽ [CACHE STALE HIT]", stale.entries.length, "prix (cache expiré réutilisé)");
          setEntries(stale.entries);
          setFetchedAt(stale.fetchedAt);
          return;
        }
        if (!legacy && !timedOutToastShownRef.current) {
          timedOutToastShownRef.current = true;
          toast.warning("Tarifs indisponibles pour cette région");
        }
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, keyLat, keyLng, timeoutMs]);

  /** Nearest price record within 500 m of a fuel POI (coordinate-level match). */
  const findPrice = useCallback(
    (lat: number, lng: number): FuelPriceEntry | null => {
      let best: FuelPriceEntry | null = null;
      let bestD = 500;
      for (const e of entries) {
        const d = distanceM(lat, lng, e.lat, e.lng);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) {
        console.log("⛽ [P11-E] aucun prix proche pour", lat, lng, "(chargés:", entries.length, ")");
      }
      return best;
    },
    [entries],
  );

  return { entries, findPrice, loading, fetchedAt };
}
