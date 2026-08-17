import type { FastfoodPOI } from "@/types/fastfoods";

interface CacheEntry {
  data: FastfoodPOI[];
  timestamp: number;
}

const TTL_MS = 30 * 60 * 1000;
const fastFoodCache = new Map<string, CacheEntry>();

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
