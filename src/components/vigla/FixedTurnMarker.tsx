import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";

/**
 * Fixed orange indicator at the bottom-centre of the screen pointing at the
 * next manoeuvre. It never moves; only its pulse intensity changes.
 */
export function FixedTurnMarker() {
  const navigation = useVigla((s) => s.navigation);
  const lastLogRef = useRef(0);

  const step = navigation?.steps?.[navigation.currentStepIndex];
  const distanceM = Math.round(navigation?.distanceToNextManeuverM ?? 0);
  const instruction = step?.instruction ?? "—";

  useEffect(() => {
    if (!navigation) return;
    const now = Date.now();
    if (now - lastLogRef.current < 2000) return;
    lastLogRef.current = now;
    console.log(
      `🧭 [TURN MARKER] Next turn: ${instruction} • Distance: ${distanceM}m`,
    );
  }, [navigation, instruction, distanceM]);

  if (!navigation || navigation.arrived) return null;

  const close = distanceM > 0 && distanceM < 500;

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
      style={{ bottom: "20%" }}
    >
      <div
        className={`pointer-events-auto h-7 w-7 rounded-full ${close ? "animate-[vigla-turn-pulse_1.5s_ease-in-out_infinite]" : ""}`}
        style={{
          background: "#FF8C00",
          boxShadow: "0 0 0 4px rgba(255,140,0,0.25), 0 4px 12px rgba(15,23,42,0.35)",
        }}
        title={`Prochain tournant à ${distanceM}m`}
        aria-label={`Prochain tournant à ${distanceM} mètres`}
      />
    </div>
  );
}
