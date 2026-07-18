import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { OfficialRadar } from "@/types/vigla";

const CACHE_KEY = "vigla:official-radars-cache";
const REFRESH_KEY = "vigla:official-radars-refresh";
const SESSION_KEY = "vigla:official-radars-refresh-tried";
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useOfficialRadars() {
  const setOfficialRadars = useVigla((s) => s.setOfficialRadars);

  useEffect(() => {
    let cancelled = false;

    async function refreshIfStale(rowCount: number) {
      // Only try once per session to avoid burning invocations.
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
      } catch {}
      const last = Number(localStorage.getItem(REFRESH_KEY) ?? 0);
      const stale = rowCount === 0 || Date.now() - last > REFRESH_INTERVAL_MS;
      if (!stale) return;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
      try {
        const { error } = await supabase.functions.invoke(
          "import-official-radars",
          { body: {} },
        );
        if (error) return;
        localStorage.setItem(REFRESH_KEY, String(Date.now()));
        // Reload after import completes.
        const { data } = await supabase.from("official_radars").select("*");
        if (!cancelled && data) {
          setOfficialRadars(data as OfficialRadar[]);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          } catch {}
        }
      } catch {
        /* noop */
      }
    }

    async function load() {
      try {
        const { data, error } = await supabase
          .from("official_radars")
          .select("*");
        if (error) throw error;
        if (cancelled) return;
        const rows = (data ?? []) as OfficialRadar[];
        setOfficialRadars(rows);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
        } catch {}
        refreshIfStale(rows.length);
      } catch {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) setOfficialRadars(JSON.parse(cached) as OfficialRadar[]);
        } catch {}
        refreshIfStale(0);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [setOfficialRadars]);
}
