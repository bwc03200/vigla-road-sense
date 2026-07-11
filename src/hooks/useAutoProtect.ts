import { useEffect, useRef, useState } from "react";
import { useVigla } from "@/lib/vigla-store";

const SPEED_MIN_KMH = 15;
const HOLD_MS = 60_000;

/** Detects sustained driving speed and suggests activating protection. */
export function useAutoProtect(): {
  suggest: boolean;
  dismiss: () => void;
} {
  const speedKmh = useVigla((s) => s.speedKmh);
  const navigation = useVigla((s) => s.navigation);
  const dismissedAt = useVigla((s) => s.autoProtectDismissedAt);
  const setDismissed = useVigla((s) => s.setAutoProtectDismissed);
  const sinceMovingAtRef = useRef<number | null>(null);
  const [suggest, setSuggest] = useState(false);

  useEffect(() => {
    if (navigation) {
      sinceMovingAtRef.current = null;
      setSuggest((s) => (s ? false : s));
      return;
    }
    if (dismissedAt && Date.now() - dismissedAt < 15 * 60_000) return;

    if (speedKmh >= SPEED_MIN_KMH) {
      if (sinceMovingAtRef.current == null) {
        sinceMovingAtRef.current = Date.now();
      }
      if (Date.now() - sinceMovingAtRef.current > HOLD_MS) {
        setSuggest((s) => (s ? s : true));
      }
    } else if (speedKmh < 5) {
      sinceMovingAtRef.current = null;
      setSuggest((s) => (s ? false : s));
    }
  }, [speedKmh, navigation, dismissedAt]);

  return {
    suggest,
    dismiss: () => {
      setSuggest(false);
      setDismissed();
    },
  };
}
