import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getFastfoods } from "@/lib/fastfoods.functions";
import type { FastfoodPOI } from "@/types/fastfoods";

export interface FastfoodBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Below this zoom we don't query Overpass (too many POIs, useless at scale). */
export const MIN_ZOOM_FOR_FASTFOODS = 13;

/** Round the bbox so tiny GPS-driven viewport shifts don't refetch constantly. */
function keyOf(b: FastfoodBBox): string {
  const r = (n: number) => (Math.round(n * 20) / 20).toFixed(2);
  return `${r(b.south)},${r(b.west)},${r(b.north)},${r(b.east)}`;
}

/**
 * Viewport-scoped fast-food POIs, fetched through the server function
 * (Overpass is not reachable from the browser origin). Cached 1h.
 */
export function useFastfoods(
  bbox: FastfoodBBox | null,
  zoom: number,
  enabled: boolean,
) {
  const active = enabled && !!bbox && zoom >= MIN_ZOOM_FOR_FASTFOODS;
  const bboxKey = bbox ? keyOf(bbox) : "none";

  useEffect(() => {
    console.log("🍔 [BBOX]", bboxKey, { zoom, enabled, active, bbox });
  }, [bboxKey, zoom, enabled, active, bbox]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fastfoods", bboxKey],
    queryFn: async () => {
      console.log("🍔 [FETCH START]", bboxKey);
      try {
        const res = await getFastfoods({ data: bbox! });
        console.log("🍔 [FETCH RESULT]", res);
        if (!res.ok) throw new Error(res.error);
        console.log(`🍔 [SUCCESS] Got ${res.data.length} POIs`);
        return res.data as FastfoodPOI[];
      } catch (err) {
        console.error("🍔 [FETCH ERROR]", err);
        throw err;
      }
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 3 * 60 * 60 * 1000,
    retry: 1,
    enabled: active,
  });

  useEffect(() => {
    console.log("🍔 [QUERY STATE]", {
      isLoading,
      dataLength: data?.length ?? 0,
      error: error instanceof Error ? error.message : error,
    });
  }, [isLoading, data, error]);

  useEffect(() => {
    if (error) {
      console.error("🍔 [ERROR TOAST TRIGGER]", error);
      toast.error("Restaurants indisponibles", {
        description: error instanceof Error ? error.message : String(error),
        id: "fastfoods-error",
      });
    }
  }, [error]);

  const fastfoods = data ?? [];

  useEffect(() => {
    console.log("🍔 [RETURN] fastfoods:", fastfoods.length);
  }, [fastfoods.length]);

  return { fastfoods, isLoading, error };
}

