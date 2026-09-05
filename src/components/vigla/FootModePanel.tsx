import { useEffect, useRef, useState } from "react";
import { Footprints } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { formatDistance } from "@/lib/geo";

function formatCountdown(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

/**
 * Walking-mode panel: live countdown of the remaining time (1s ticks) plus
 * the turn-by-turn steps extracted from the OSRM "foot" response.
 * Purely presentational — reads state, never mutates it.
 */
export function FootModePanel() {
  const navigation = useVigla((s) => s.navigation);
  const footSteps = useVigla((s) => s.footModeSteps);
  const remainingS = navigation?.durationRemainingS ?? 0;
  const [countdown, setCountdown] = useState(remainingS);
  const lastSyncRef = useRef(remainingS);

  // Re-sync whenever the engine publishes a fresh estimate.
  useEffect(() => {
    if (remainingS !== lastSyncRef.current) {
      lastSyncRef.current = remainingS;
      setCountdown(remainingS);
    }
  }, [remainingS]);

  // 1-second local countdown between engine updates.
  useEffect(() => {
    const id = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    console.log(
      `🚶 [FOOT MODE PANEL] Countdown active • steps: ${footSteps.length}`,
    );
  }, [footSteps.length]);

  if (!navigation || navigation.arrived) return null;

  const steps = footSteps.length > 0 ? footSteps : navigation.steps;
  const upcoming = steps.slice(navigation.currentStepIndex, navigation.currentStepIndex + 4);

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-24 z-[640]">
      <div className="pointer-events-auto rounded-2xl border border-border bg-card/95 p-3 shadow-[0_10px_28px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-blue-600">
            <Footprints aria-hidden className="h-4 w-4" />
            <span className="text-[12px] font-semibold">Mode Piéton</span>
          </div>
          <div className="font-mono text-[15px] font-bold tabular-nums">
            {formatCountdown(countdown)}
            <span className="ml-2 text-[11px] font-normal opacity-70">
              {formatDistance(navigation.distanceRemainingM)}
            </span>
          </div>
        </div>

        {upcoming.length > 0 && (
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {upcoming.map((step, i) => (
              <li
                key={`${step.instruction}-${i}`}
                className={`flex items-center justify-between gap-2 text-[12px] ${
                  i === 0 ? "font-semibold" : "opacity-70"
                }`}
              >
                <span className="truncate">{step.instruction}</span>
                <span className="shrink-0 tabular-nums opacity-70">
                  {formatDistance(step.distanceMeters)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
