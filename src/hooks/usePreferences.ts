import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { UserPreferences } from "@/types/vigla";

type AnyClient = { from: (t: string) => any };
const db = supabase as unknown as AnyClient;

export const DEFAULT_PREFERENCES: UserPreferences = {
  speed_unit: "kmh",
  map_theme: "light",
  auto_recenter: true,
  voice_alerts: false,
  sound_alerts: true,
  vibration_alerts: true,
  alert_lead_time: "normal",
  moto_mode: false,
};

export function usePreferences(userId: string | null) {
  const setPreferences = useVigla((s) => s.setPreferences);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    db.from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(async ({ data }: { data: UserPreferences | null }) => {
        if (cancelled) return;
        if (!data) {
          await db
            .from("user_preferences")
            .insert({ user_id: userId, ...DEFAULT_PREFERENCES });
          setPreferences(DEFAULT_PREFERENCES);
        } else {
          setPreferences({ ...DEFAULT_PREFERENCES, ...data });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, setPreferences]);
}

export async function savePreferences(
  userId: string,
  patch: Partial<UserPreferences>,
) {
  const current = useVigla.getState().preferences;
  const next = { ...current, ...patch };
  useVigla.getState().setPreferences(next);
  await db
    .from("user_preferences")
    .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
}
