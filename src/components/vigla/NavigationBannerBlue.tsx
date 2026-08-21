import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";
import { formatDistance } from "@/lib/geo";
import { useStreetName } from "@/hooks/useStreetName";

/**
 * Compact blue navigation banner (top-left): current street + remaining
 * distance and ETA. Never rotates with the map.
 */
export function NavigationBannerBlue() {
  const navigation = useVigla((s) => s.navigation);
  const position = useVigla((s) => s.position);
  // Throttle geocoding input to ~4-decimal precision (≈10 m).
  const street = useStreetName(position?.lat ?? null, position?.lng ?? null, !!navigation);
  const lastLogRef = useRef(0);

  const distanceM = navigation?.distanceRemainingM ?? 0;
  const etaMin = Math.max(0, Math.round((navigation?.durationRemainingS ?? 0) / 60));

  useEffect(() => {
    if (!navigation) return;
    const now = Date.now();
    if (now - lastLogRef.current < 2000) return;
    lastLogRef.current = now;
    console.log(
      `🧭 [NAV BANNER] Street: ${street ?? "inconnu"} • Distance: ${(distanceM / 1000).toFixed(1)}km • ETA: ${etaMin}min`,
    );
  }, [navigation, street, distanceM, etaMin]);

  if (!navigation || navigation.arrived) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-[8.5rem] z-[635] max-w-[60vw]">
      <div
        className="pointer-events-auto rounded-xl px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.18)] backdrop-blur"
        style={{
          background: "rgba(0, 102, 255, 0.88)",
          border: "1px solid rgba(255,255,255,0.35)",
          color: "#ffffff",
          minWidth: 100,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="text-sm leading-none">
            🧭
          </span>
          <span className="truncate text-[12px] font-semibold leading-tight">
            {street ?? "En navigation…"}
          </span>
        </div>
        <div className="mt-0.5 font-mono text-[11px] tabular-nums opacity-95">
          {formatDistance(distanceM)} • {etaMin} min
        </div>
      </div>
    </div>
  );
}
