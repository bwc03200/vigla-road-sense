import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useVigla } from "@/lib/vigla-store";
import { haversine, formatDistance } from "@/lib/geo";

const LOOKAHEAD_M = 300;
const ON_ROUTE_M = 35;

/**
 * Passive, discreet indication of the next traffic light along the active
 * route (within ~300m). Purely informational: no sound, no voice, and it
 * never replaces the turn instruction.
 */
export function TrafficSignalAhead({ moto = false }: { moto?: boolean }) {
  const { t } = useTranslation();
  const navigation = useVigla((s) => s.navigation);
  const signals = useVigla((s) => s.trafficSignals);
  const show = useVigla((s) => s.showTrafficSignals);

  const distance = useMemo(() => {
    if (!show || !navigation || navigation.arrived) return null;
    const coords = navigation.remainingCoords;
    if (coords.length < 2 || signals.length === 0) return null;
    let along = 0;
    for (let i = 1; i < coords.length && along < LOOKAHEAD_M; i++) {
      const [pLat, pLng] = coords[i - 1];
      const [la, ln] = coords[i];
      along += haversine(pLat, pLng, la, ln);
      for (const s of signals) {
        if (haversine(la, ln, s.latitude, s.longitude) <= ON_ROUTE_M) {
          return along;
        }
      }
    }
    return null;
  }, [navigation, signals, show]);

  if (distance == null) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        moto ? "" : "bg-white/10 text-white/80"
      }`}
      style={
        moto
          ? {
              background: "var(--moto-panel, #14171b)",
              border: "1px solid var(--moto-line, #242830)",
              color: "var(--moto-text-dim, #8b9299)",
            }
          : undefined
      }
    >
      <span aria-hidden="true" className="flex flex-col gap-[2px]">
        <span className="block h-1 w-1 rounded-full bg-[#EF4444]" />
        <span className="block h-1 w-1 rounded-full bg-[#F59E0B]" />
        <span className="block h-1 w-1 rounded-full bg-[#22C55E]" />
      </span>
      {t("trafficSignals.ahead", { distance: formatDistance(distance) })}
    </span>
  );
}
