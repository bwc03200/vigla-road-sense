import { useEffect, useState } from "react";
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
  const [sinceMovingAt, setSinceMovingAt] = useState<number | null>(null);
  const [suggest, setSuggest] = useState(false);

  useEffect(() => {
    if (navigation) {
      setSinceMovingAt(null);
      setSuggest(false);
      return;
    }
    if (dismissedAt && Date.now() - dismissedAt < 15 * 60_000) return;

    if (speedKmh >= SPEED_MIN_KMH) {
      const start = sinceMovingAt ?? Date.now();
      if (sinceMovingAt == null) setSinceMovingAt(start);
      if (Date.now() - start > HOLD_MS) setSuggest(true);
    } else if (speedKmh < 5) {
      setSinceMovingAt(null);
      setSuggest(false);
    }
  }, [speedKmh, navigation, dismissedAt, sinceMovingAt]);

  return {
    suggest,
    dismiss: () => {
      setSuggest(false);
      setDismissed();
    },
  };
}
