import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { Roadbook } from "@/types/vigla";

type AnyClient = { from: (t: string) => any };
const db = supabase as unknown as AnyClient;

export function useRoadbooks(userId: string | null) {
  const setRoadbooks = useVigla((s) => s.setRoadbooks);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    db.from("roadbooks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }: { data: Roadbook[] | null }) => {
        if (!cancelled && data) setRoadbooks(data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, setRoadbooks]);

  async function create(input: {
    title: string;
    description?: string;
    durationDays?: number;
    distanceKm?: number;
    coords?: [number, number][];
    destination?: { lat: number; lng: number; label: string };
    isPublic?: boolean;
  }) {
    if (!userId) return;
    const { data, error } = await db
      .from("roadbooks")
      .insert({
        created_by: userId,
        title: input.title,
        description: input.description || null,
        duration_days: input.durationDays ?? 1,
        distance_km: input.distanceKm ?? null,
        route_geojson: input.coords
          ? { coords: input.coords, destination: input.destination }
          : null,
        is_public: !!input.isPublic,
      })
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Enregistrement impossible");
      return;
    }
    const current = useVigla.getState().roadbooks;
    useVigla.getState().setRoadbooks([data as Roadbook, ...current]);
    toast.success("Roadbook enregistré");
  }

  async function remove(id: string) {
    const { error } = await db.from("roadbooks").delete().eq("id", id);
    if (error) return toast.error("Suppression impossible");
    const current = useVigla.getState().roadbooks;
    useVigla.getState().setRoadbooks(current.filter((r) => r.id !== id));
  }

  return { create, remove };
}
