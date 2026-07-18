import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";
import { vibrateAlert } from "@/lib/haptics";
import { hazardLabel } from "@/lib/i18n-helpers";


const ALERT_RADIUS_M = 400;
const LEAD_TIME_S: Record<"short" | "normal" | "long", number> = {
  short: 15,
  normal: 30,
  long: 50,
};


function beep() {
  try {
    const Ctor: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? (window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext)
        : undefined;
    if (!Ctor) return;
    const ctx = new Ctor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.45);
  } catch {}
}

export function useAlerts(
  onAlert?: (label: string, distanceM: number) => void,
) {
  const position = useVigla((s) => s.position);
  const speedKmh = useVigla((s) => s.speedKmh);
  const hazards = useVigla((s) => s.hazards);
  const route = useVigla((s) => s.route);
  const alertedIds = useVigla((s) => s.alertedIds);
  const markAlerted = useVigla((s) => s.markAlerted);
  const clearAlert = useVigla((s) => s.clearAlert);
  const soundAlerts = useVigla((s) => s.preferences.sound_alerts);
  const vibrationAlerts = useVigla((s) => s.preferences.vibration_alerts);
  const leadTime = useVigla((s) => s.preferences.alert_lead_time);
  const cbRef = useRef(onAlert);
  cbRef.current = onAlert;

  useEffect(() => {
    if (!position) return;
    const speedMs = Math.max((speedKmh * 1000) / 3600, 3);
    const allowed = route ? new Set(route.hazardIds) : null;
    const leadS = LEAD_TIME_S[leadTime] ?? LEAD_TIME_S.normal;

    for (const h of hazards) {
      if (allowed && !allowed.has(h.id)) continue;
      const d = haversine(position.lat, position.lng, h.latitude, h.longitude);
      const eta = d / speedMs;
      const already = alertedIds.has(h.id);

      if (!already && eta < leadS && d < 3000) {
        markAlerted(h.id);
        if (soundAlerts) beep();
        if (vibrationAlerts) vibrateAlert();
        cbRef.current?.(hazardLabel(h.type), d);

      } else if (already && d > ALERT_RADIUS_M * 2) {
        clearAlert(h.id);
      }
    }
  }, [position, speedKmh, hazards, route, alertedIds, markAlerted, clearAlert, soundAlerts, vibrationAlerts, leadTime]);
}

