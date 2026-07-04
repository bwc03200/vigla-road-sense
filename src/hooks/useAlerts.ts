import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";
import { HAZARD_LABELS } from "@/types/vigla";

const ALERT_RADIUS_M = 400; // considered "in zone"
const ALERT_LEAD_S = 30;

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
  const alertedIds = useVigla((s) => s.alertedIds);
  const markAlerted = useVigla((s) => s.markAlerted);
  const clearAlert = useVigla((s) => s.clearAlert);
  const cbRef = useRef(onAlert);
  cbRef.current = onAlert;

  useEffect(() => {
    if (!position) return;
    const speedMs = Math.max((speedKmh * 1000) / 3600, 3); // min 3 m/s for stopped user

    for (const h of hazards) {
      const d = haversine(position.lat, position.lng, h.latitude, h.longitude);
      const eta = d / speedMs;
      const already = alertedIds.has(h.id);

      if (!already && eta < ALERT_LEAD_S && d < 3000) {
        markAlerted(h.id);
        beep();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.([200, 100, 200]);
        }
        cbRef.current?.(HAZARD_LABELS[h.type], d);
      } else if (already && d > ALERT_RADIUS_M * 2) {
        // exited the zone → allow re-alert next time
        clearAlert(h.id);
      }
    }
  }, [position, speedKmh, hazards, alertedIds, markAlerted, clearAlert]);
}
