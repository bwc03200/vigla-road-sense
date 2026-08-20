import { useCallback, useEffect, useRef, useState } from "react";

/**
 * P11-E — Fuel prices from the free public dataset
 * "prix-des-carburants-en-france-flux-instantane-v2" (data.economie.gouv.fr).
 *
 * Purely additive: nothing in navigation / routing depends on it. When the API
 * is unreachable we simply keep the last cache (or no price at all) and the UI
 * degrades gracefully to "prix non disponible".
 */

const CACHE_KEY = "vigla:fuel-prices-cache";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const RADIUS_KM = 25;
const LIMIT = 300;
const API =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records";

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

interface CacheShape {
  center: { lat: number; lng: number };
  fetchedAt: number;
  entries: FuelPriceEntry[];
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch {
    return null;
  }
}

function writeCache(c: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota */
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
 * Loads fuel prices around `center` (cached 30 min in localStorage) and
 * exposes a matcher resolving an Overpass fuel POI to its price record.
 */
export function useGasStationPrices(
  center: { lat: number; lng: number } | null,
  enabled = true,
) {
  const [entries, setEntries] = useState<FuelPriceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !center) return;
    const cached = readCache();
    const fresh =
      cached &&
      Date.now() - cached.fetchedAt < CACHE_TTL_MS &&
      distanceM(cached.center.lat, cached.center.lng, center.lat, center.lng) < 15000;

    if (cached?.entries?.length) {
      setEntries(cached.entries);
      setFetchedAt(cached.fetchedAt);
    }
    if (fresh || requestedRef.current) {
      if (fresh) console.log("⛽ [P11-E] prix en cache", cached?.entries.length ?? 0);
      return;
    }
    requestedRef.current = true;

    const geomLiteral = `GEOM'POINT(${center.lng} ${center.lat})'`;
    const url =
      `${API}?limit=${LIMIT}&select=id,geom,adresse,ville,gazole_prix,gazole_maj,sp95_prix,sp95_maj,e10_prix,e10_maj` +
      `&where=${encodeURIComponent(
        `within_distance(geom, ${geomLiteral}, ${RADIUS_KM}km)`,
      )}` +
      `&order_by=${encodeURIComponent(`distance(geom, ${geomLiteral})`)}`;

    let cancelled = false;
    setLoading(true);
    fetch(url, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ results?: ApiRecord[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        const rows = (data.results ?? [])
          .map(toEntry)
          .filter((e): e is FuelPriceEntry => e !== null);
        console.log("⛽ [P11-E] prix chargés", rows.length);
        setEntries(rows);
        const now = Date.now();
        setFetchedAt(now);
        writeCache({ center, fetchedAt: now, entries: rows });
      })
      .catch((err) => {
        requestedRef.current = false;
        console.log("⛽ [P11-E] prix indisponibles", String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, center?.lat, center?.lng]);

  /** Nearest price record within 300 m of a fuel POI (SIRET-level match). */
  const findPrice = useCallback(
    (lat: number, lng: number): FuelPriceEntry | null => {
      let best: FuelPriceEntry | null = null;
      let bestD = 300;
      for (const e of entries) {
        const d = distanceM(lat, lng, e.lat, e.lng);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    },
    [entries],
  );

  return { entries, findPrice, loading, fetchedAt };
}
