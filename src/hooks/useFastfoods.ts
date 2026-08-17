import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFastfoods } from "@/lib/fastfoods.functions";
import { checkCache, storeCache } from "@/lib/fastfood-cache";
import type { FastfoodPOI } from "@/types/fastfoods";


export interface FastfoodBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Below this zoom we don't query Overpass (too many POIs, useless at scale). */
export const MIN_ZOOM_FOR_FASTFOODS = 11;

const MAX_RETRIES = 3;

/** Round the bbox so tiny GPS-driven viewport shifts don't refetch constantly. */
function keyOf(b: FastfoodBBox): string {
  const r = (n: number) => (Math.round(n * 20) / 20).toFixed(2);
  return `${r(b.south)},${r(b.west)},${r(b.north)},${r(b.east)}`;
}

/**
 * Viewport-scoped fast-food POIs, fetched through the server function
 * (Overpass is not reachable from the browser origin). Cached 1h, with
 * self-healing retries (exponential backoff 1s / 2s / 4s) before surfacing
 * a manual retry affordance.
 */
export function useFastfoods(
  bbox: FastfoodBBox | null,
  zoom: number,
  enabled = true,
) {
  const isZoomValid = zoom >= MIN_ZOOM_FOR_FASTFOODS;
  const active = enabled && !!bbox && isZoomValid;
  const bboxKey = bbox ? keyOf(bbox) : "none";

  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log("🍔 [BBOX]", { active, zoom, bbox });
  }, [bboxKey, zoom, active, bbox]);

  // A new viewport is a fresh attempt budget.
  useEffect(() => {
    setRetryCount(0);
  }, [bboxKey]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["fastfoods", bboxKey],
    queryFn: async () => {
      console.log("🍔 [FETCH START]", bboxKey);
      const res = await getFastfoods({ data: bbox! });
      console.log("🍔 [FETCH RESULT]", res);
      if (!res.ok) throw new Error(res.error);
      console.log(`🍔 [SUCCESS] ${res.data.length} POIs`);
      setRetryCount(0);
      return res.data as FastfoodPOI[];
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 3 * 60 * 60 * 1000,
    retry: false,
    enabled: active,
  });

  // Proactive city/agglomeration fetch: start loading POIs as soon as the
  // user zooms into the 11-12 range, before they reach the normal 13+ threshold.
  useEffect(() => {
    if (zoom >= 11 && zoom < 13 && bbox && !isLoading) {
      console.log("🍔 [PROACTIVE] City zoom detected, pre-fetching POIs");
      void refetch();
    }
  }, [zoom, bbox, isLoading, refetch]);

  // AUTO-HEAL: retry with exponential backoff.
  useEffect(() => {
    if (!error || !active || retryCount >= MAX_RETRIES) return;
    const delay = Math.pow(2, retryCount) * 1000;
    console.log("🍔 [AUTO-HEAL] Retrying in", delay, "ms");
    retryTimeoutRef.current = setTimeout(() => {
      setRetryCount((n) => n + 1);
      void refetch();
    }, delay);
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [error, retryCount, active, refetch]);

  const fastfoods = data ?? [];
  const hasData = fastfoods.length > 0;
  const isFailing = !!error && retryCount >= MAX_RETRIES;

  useEffect(() => {
    console.log("🍔 [STATE]", {
      count: fastfoods.length,
      hasData,
      isFailing,
      retryCount,
      loading: isLoading,
    });
  }, [fastfoods.length, hasData, isFailing, retryCount, isLoading]);

  const retryManually = useCallback(() => {
    console.log("🍔 [MANUAL RETRY]");
    setRetryCount(0);
    void refetch();
  }, [refetch]);

  return {
    fastfoods,
    isLoading,
    error,
    isZoomValid,
    hasData,
    isFailing,
    retryManually,
  };
}
