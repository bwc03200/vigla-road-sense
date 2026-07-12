import { useEffect, useRef, useState } from "react";
import { useVigla } from "@/lib/vigla-store";

const SPEED_MIN_KMH = 15;
const HOLD_MS = 60_000;
const DISMISS_COOLDOWN_MS = 15 * 60_000;
const TICK_MS = 1_000;

type Phase = "idle" | "monitoring" | "proposed";

/** Detects sustained driving speed and suggests activating protection. */
export function useAutoProtect(): {
  suggest: boolean;
  dismiss: () => void;
} {
  const setDismissed = useVigla((s) => s.setAutoProtectDismissed);
  const [suggest, setSuggest] = useState(false);

  // Internal state kept in refs so ticking does not re-render or re-run effect.
  const phaseRef = useRef<Phase>("idle");
  const sinceMovingAtRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useVigla.getState();
      const speedKmh = state.speedKmh;
      const navigation = state.navigation;
      const dismissedAt = state.autoProtectDismissedAt;

      // Active navigation -> stand down.
      if (navigation) {
        if (phaseRef.current !== "idle") {
          phaseRef.current = "idle";
          sinceMovingAtRef.current = null;
          setSuggest((s) => (s ? false : s));
        }
        return;
      }

      // Recently dismissed -> stay idle during cooldown.
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
        if (phaseRef.current !== "idle") {
          phaseRef.current = "idle";
          sinceMovingAtRef.current = null;
          setSuggest((s) => (s ? false : s));
        }
        return;
      }

      // Speed dropped clearly below threshold -> reset.
      if (speedKmh < 5) {
        if (phaseRef.current !== "idle") {
          phaseRef.current = "idle";
          sinceMovingAtRef.current = null;
          setSuggest((s) => (s ? false : s));
        }
        return;
      }

      // Not fast enough yet, but not stopped either -> keep current phase.
      if (speedKmh < SPEED_MIN_KMH) return;

      // Sustained speed >= threshold.
      if (phaseRef.current === "idle") {
        phaseRef.current = "monitoring";
        sinceMovingAtRef.current = Date.now();
        return;
      }

      if (
        phaseRef.current === "monitoring" &&
        sinceMovingAtRef.current != null &&
        Date.now() - sinceMovingAtRef.current > HOLD_MS
      ) {
        phaseRef.current = "proposed";
        setSuggest((s) => (s ? s : true));
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  return {
    suggest,
    dismiss: () => {
      phaseRef.current = "idle";
      sinceMovingAtRef.current = null;
      setSuggest(false);
      setDismissed();
    },
  };
}
