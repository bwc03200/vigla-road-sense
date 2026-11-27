import type { FastfoodPOI } from "@/types/fastfoods";
import { dlog } from "@/lib/debug";

interface CacheEntry {
  data: FastfoodPOI[];
  timestamp: number;
}

const TTL_MS = 30 * 60 * 1000;
const fastFoodCache = new Map<string, CacheEntry>();
const STORE_KEY = "vigla:fastfood-cache";
const MAX_PERSISTED = 30;

/** Survives an app reload: the same commute area shows its restaurants at once. */
function readPersisted(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

function writePersisted(all: Record<string, CacheEntry>): void {
  try {
    const kept = Object.entries(all)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, MAX_PERSISTED);
    localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* quota or private mode: memory cache still works */
  }
}

/**
 * Zoom bucket: POIs are fetched for the whole padded viewport, so nearby
 * zoom levels can safely share one entry (city 11-12, local 13-15, street 16+).
 */
function zoomBucket(zoom: number): string {
  if (zoom < 13) return "city";
  if (zoom < 16) return "local";
  return "street";
}

/** Key = viewport centre snapped to a ~5km grid + zoom bucket. */
export function getCacheKey(lat: number, lon: number, zoom: number): string {
  const snap = (n: number) => (Math.round(n * 20) / 20).toFixed(2);
  return `${snap(lat)}_${snap(lon)}_${zoomBucket(zoom)}`;
}

export function checkCache(lat: number, lon: number, zoom: number): FastfoodPOI[] | null {
  const key = getCacheKey(lat, lon, zoom);
  let cached = fastFoodCache.get(key);
  if (!cached) {
    const persisted = readPersisted()[key];
    if (persisted) {
      cached = persisted;
      fastFoodCache.set(key, persisted);
    }
  }

  if (cached && Date.now() - cached.timestamp < TTL_MS) {
    dlog("✅ [CACHE HIT]", key);
    return cached.data;
  }

  if (cached) fastFoodCache.delete(key);
  dlog("❌ [CACHE MISS]", key);
  return null;
}

export function storeCache(lat: number, lon: number, zoom: number, data: FastfoodPOI[]): void {
  const key = getCacheKey(lat, lon, zoom);
  const entry = { data, timestamp: Date.now() };
  fastFoodCache.set(key, entry);
  writePersisted({ ...readPersisted(), [key]: entry });
  dlog("💾 [CACHE STORED]", key);
}

export function clearFastfoodCache(): void {
  fastFoodCache.clear();
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}
