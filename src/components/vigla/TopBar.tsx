import { useMemo } from "react";
import { AlertTriangle, Signal } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { haversine, formatDistance, formatSpeed, speedUnitLabel } from "@/lib/geo";
import { HAZARD_LABELS } from "@/types/vigla";


export function TopBar() {
  const position = useVigla((s) => s.position);
  const speedKmh = useVigla((s) => s.speedKmh);
  const hazards = useVigla((s) => s.hazards);
  const speedUnit = useVigla((s) => s.preferences.speed_unit);
  const route = useVigla((s) => s.route);


  const nextHazard = useMemo(() => {
    if (!position) return null;
    const allowed = route ? new Set(route.hazardIds) : null;
    let best: { label: string; distance: number } | null = null;
    for (const h of hazards) {
      if (allowed && !allowed.has(h.id)) continue;
      const d = haversine(position.lat, position.lng, h.latitude, h.longitude);
      if (d < 3000 && (!best || d < best.distance)) {
        best = { label: HAZARD_LABELS[h.type], distance: d };
      }
    }
    return best;
  }, [hazards, position, route]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-slate-200">
        <div className="flex flex-col items-center leading-none">
          <span
            className="tabular-nums text-[32px] font-bold text-slate-900"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {formatSpeed(speedKmh, speedUnit)}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            {speedUnitLabel(speedUnit)}
          </span>

        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div className="min-w-0 flex-1">
          {nextHazard ? (
            <div key={nextHazard.label} className="vigla-topbar-alert flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#FF6B35]" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {nextHazard.label}
                </div>
                <div className="text-xs text-slate-500">
                  dans {formatDistance(nextHazard.distance)}
                </div>
              </div>
            </div>

          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <Signal className="h-4 w-4" />
              <span className="text-xs">
                {route ? "Itinéraire actif — voie dégagée" : "Voie dégagée"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
