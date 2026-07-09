import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";

const IMPACT_THRESHOLD = 25; // m/s²
const IDLE_MAX_MAG = 1.5; // m/s²
const IDLE_HOLD_MS = 20_000;

/**
 * Best-effort fall / crash detection using the DeviceMotion API.
 * Not a substitute for real emergency hardware — surfaced clearly in Settings.
 */
export function useCrashDetection(active: boolean) {
  const enabled = useVigla((s) => s.crashDetectionEnabled);
  const setCrashState = useVigla((s) => s.setCrashState);
  const impactAt = useRef<number | null>(null);
  const idleSince = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !enabled) return;
    if (typeof window === "undefined") return;
    if (!("DeviceMotionEvent" in window)) return;

    let mounted = true;

    async function askPermission() {
      const anyEv = DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<PermissionState | "granted" | "denied">;
      };
      if (typeof anyEv.requestPermission === "function") {
        try {
          const r = await anyEv.requestPermission();
          return r === "granted";
        } catch {
          return false;
        }
      }
      return true;
    }

    function onMotion(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity ?? e.acceleration;
      if (!a) return;
      const x = a.x ?? 0;
      const y = a.y ?? 0;
      const z = a.z ?? 0;
      // Subtract gravity roughly using accelerationIncludingGravity magnitude.
      const mag = Math.sqrt(x * x + y * y + z * z);
      const linear = Math.abs(mag - 9.81);
      const now = Date.now();

      if (linear > IMPACT_THRESHOLD) {
        impactAt.current = now;
        idleSince.current = now;
        return;
      }
      if (impactAt.current) {
        if (linear < IDLE_MAX_MAG) {
          if (!idleSince.current) idleSince.current = now;
          if (now - idleSince.current > IDLE_HOLD_MS) {
            impactAt.current = null;
            idleSince.current = null;
            setCrashState({ status: "suspected", startedAt: now });
          }
        } else {
          idleSince.current = null;
        }
      }
    }

    let listener: ((e: DeviceMotionEvent) => void) | null = null;
    askPermission().then((ok) => {
      if (!ok || !mounted) return;
      listener = onMotion;
      window.addEventListener("devicemotion", listener);
    });

    return () => {
      mounted = false;
      if (listener) window.removeEventListener("devicemotion", listener);
    };
  }, [active, enabled, setCrashState]);
}
