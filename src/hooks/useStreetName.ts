import { useEffect, useRef, useState } from "react";

const CACHE_KEY = "vigla.street-names.v1";
const TTL_MS = 24 * 60 * 60 * 1000;
/** Don't hit Nominatim more than once every 8 s. */
const MIN_INTERVAL_MS = 8000;

type CacheShape = Record<string, { name: string; at: number }>;

function readCache(): CacheShape {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(cache: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

function keyFor(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Non-blocking, cached reverse geocoding of the current road name
 * (OSM `road` tag). Returns null while unknown — callers show a fallback.
 */
export function useStreetName(
  lat: number | null | undefined,
  lng: number | null | undefined,
  enabled = true,
) {
  const [street, setStreet] = useState<string | null>(null);
  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || lat == null || lng == null) return;
    const key = keyFor(lat, lng);
    const cache = readCache();
    const hit = cache[key];
    if (hit && Date.now() - hit.at < TTL_MS) {
      setStreet(hit.name);
      return;
    }
    if (Date.now() - lastFetchAtRef.current < MIN_INTERVAL_MS) return;
    lastFetchAtRef.current = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "17");

    fetch(url.toString(), { signal: controller.signal, headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { address?: Record<string, string | undefined> } | null) => {
        const a = data?.address ?? {};
        const name = a.road ?? a.pedestrian ?? a.footway ?? a.suburb ?? a.city ?? null;
        if (!name) return;
        setStreet(name);
        const next = readCache();
        next[key] = { name, at: Date.now() };
        writeCache(next);
      })
      .catch(() => {
        /* offline / aborted: keep previous value */
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [lat, lng, enabled]);

  return street;
}
