import { useMemo } from "react";
import { AlertTriangle, Signal } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { haversine, formatDistance, formatSpeed } from "@/lib/geo";
import { HAZARD_LABELS } from "@/types/vigla";

export function TopBar() {
  const position = useVigla((s) => s.position);
  const speedKmh = useVigla((s) => s.speedKmh);
  const hazards = useVigla((s) => s.hazards);

  const nextHazard = useMemo(() => {
    if (!position) return null;
    let best: { label: string; distance: number } | null = null;
    for (const h of hazards) {
      const d = haversine(position.lat, position.lng, h.latitude, h.longitude);
      if (d < 3000 && (!best || d < best.distance)) {
        best = { label: HAZARD_LABELS[h.type], distance: d };
      }
    }
    return best;
  }, [hazards, position]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-card/85 px-4 py-3 shadow-lg backdrop-blur-md ring-1 ring-border">
        <div className="flex flex-col items-center leading-none">
          <span
            className="tabular-nums text-[32px] font-bold text-foreground"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {formatSpeed(speedKmh)}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            km/h
          </span>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="min-w-0 flex-1">
          {nextHazard ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {nextHazard.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  dans {formatDistance(nextHazard.distance)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Signal className="h-4 w-4" />
              <span className="text-xs">Voie dégagée</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
