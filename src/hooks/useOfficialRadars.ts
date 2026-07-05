import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { OfficialRadar } from "@/types/vigla";

const CACHE_KEY = "vigla:official-radars-cache";

export function useOfficialRadars() {
  const setOfficialRadars = useVigla((s) => s.setOfficialRadars);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("official_radars")
          .select("*");
        if (error) throw error;
        if (cancelled) return;
        setOfficialRadars((data ?? []) as OfficialRadar[]);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data ?? []));
        } catch {}
      } catch {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) setOfficialRadars(JSON.parse(cached) as OfficialRadar[]);
        } catch {}
      }
    }

    load();
  }, [setOfficialRadars]);
}
