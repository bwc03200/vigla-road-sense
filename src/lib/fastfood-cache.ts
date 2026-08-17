import type { FastfoodPOI } from "@/types/fastfoods";

interface CacheEntry {
  data: FastfoodPOI[];
  timestamp: number;
}

const TTL_MS = 30 * 60 * 1000;
const fastFoodCache = new Map<string, CacheEntry>();

/** Key = viewport centre rounded to ~1km + zoom level. */
export function getCacheKey(lat: number, lon: number, zoom: number): string {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `${roundedLat}_${roundedLon}_${zoom}`;
}

export function checkCache(lat: number, lon: number, zoom: number): FastfoodPOI[] | null {
  const key = getCacheKey(lat, lon, zoom);
  const cached = fastFoodCache.get(key);

  if (cached && Date.now() - cached.timestamp < TTL_MS) {
    console.log("✅ [CACHE HIT]", key);
    return cached.data;
  }

  if (cached) fastFoodCache.delete(key);
  console.log("❌ [CACHE MISS]", key);
  return null;
}

export function storeCache(lat: number, lon: number, zoom: number, data: FastfoodPOI[]): void {
  const key = getCacheKey(lat, lon, zoom);
  fastFoodCache.set(key, { data, timestamp: Date.now() });
  console.log("💾 [CACHE STORED]", key);
}

export function clearFastfoodCache(): void {
  fastFoodCache.clear();
}
