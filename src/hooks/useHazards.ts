import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { HazardReport } from "@/types/vigla";

const CACHE_KEY = "vigla:hazards-cache";

export function useHazards() {
  const setHazards = useVigla((s) => s.setHazards);
  const upsertHazard = useVigla((s) => s.upsertHazard);
  const setOnline = useVigla((s) => s.setOnline);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("hazard_reports")
          .select("*")
          .gt("expires_at", nowIso);
        if (error) throw error;
        if (cancelled) return;
        setHazards(data as HazardReport[]);
        setOnline(true);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {}
      } catch {
        setOnline(false);
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) setHazards(JSON.parse(cached) as HazardReport[]);
        } catch {}
      }
    }

    load();
    const retry = setInterval(load, 30000);

    const channel = supabase
      .channel("hazard_reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hazard_reports" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as HazardReport;
          if (row && row.expires_at && new Date(row.expires_at) > new Date()) {
            upsertHazard(row);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(retry);
      supabase.removeChannel(channel);
    };
  }, [setHazards, upsertHazard, setOnline]);
}

/**
 * Confirme un signalement via RPC dédié (SECURITY DEFINER côté serveur).
 * L'UPDATE direct sur hazard_reports est révoqué pour `authenticated` afin
 * d'empêcher toute modification d'autres champs (position, type, reported_by…).
 */
export async function confirmHazard(hazardId: string) {
  const { error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
  }).rpc("confirm_hazard", { hazard_id: hazardId });
  if (error) throw error;
}

export async function denyHazard(hazardId: string) {
  const { error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
  }).rpc("deny_hazard", { hazard_id: hazardId });
  if (error) throw error;
}
