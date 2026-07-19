import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { OfficialRadar } from "@/types/vigla";

const CACHE_KEY = "vigla:official-radars-cache";
const REFRESH_KEY = "vigla:official-radars-refresh";
const SESSION_KEY = "vigla:official-radars-refresh-tried";
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function fetchRadars(): Promise<OfficialRadar[]> {
  const { data, error } = await supabase
    .from("official_radars")
    .select("*")
    .limit(5000);
  if (error) {
    console.error("[official-radars] fetch error", error);
    throw error;
  }
  return (data ?? []) as OfficialRadar[];
}

/**
 * Manually trigger a refresh of the official radars dataset via the edge
 * function. Bypasses throttles. Returns { count } on success.
 */
export async function refreshOfficialRadars(): Promise<{ count: number }> {
  const { data, error } = await supabase.functions.invoke(
    "import-official-radars",
    { body: {} },
  );
  if (error) {
    console.error("[official-radars] invoke error", error);
    throw error;
  }
  if (data && typeof data === "object" && (data as { success?: boolean }).success === false) {
    const msg = (data as { error?: string }).error ?? "Import failed";
    console.error("[official-radars] import failed", data);
    throw new Error(msg);
  }
  try {
    localStorage.setItem(REFRESH_KEY, String(Date.now()));
  } catch {}
  const rows = await fetchRadars();
  useVigla.getState().setOfficialRadars(rows);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {}
  return { count: (data as { count?: number })?.count ?? rows.length };
}

export function useOfficialRadars() {
  const setOfficialRadars = useVigla((s) => s.setOfficialRadars);

  useEffect(() => {
    let cancelled = false;

    async function refreshIfStale(rowCount: number) {
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
        if (error) {
          console.error("[official-radars] auto-refresh invoke error", error);
          return;
        }
        localStorage.setItem(REFRESH_KEY, String(Date.now()));
        const rows = await fetchRadars();
        if (!cancelled) {
          setOfficialRadars(rows);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
          } catch {}
        }
      } catch (err) {
        console.error("[official-radars] auto-refresh failed", err);
      }
    }

    async function load() {
      try {
        const rows = await fetchRadars();
        if (cancelled) return;
        setOfficialRadars(rows);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
        } catch {}
        refreshIfStale(rows.length);
      } catch (err) {
        console.error("[official-radars] load failed, falling back to cache", err);
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
