import { cn } from "@/lib/utils";
import type { RouteWaypoint } from "@/types/vigla";

interface WaypointRowProps {
  index: number;
  waypoint: RouteWaypoint;
  distanceM: number;
  durationS: number;
  isCurrent: boolean;
}

function formatDistance(m: number) {
  if (!Number.isFinite(m) || m < 0) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatEta(s: number) {
  if (!Number.isFinite(s) || s < 0) return "—";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function WaypointRow({
  index,
  waypoint,
  distanceM,
  durationS,
  isCurrent,
}: WaypointRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors",
        isCurrent
          ? "bg-success/15 ring-1 ring-success/30"
          : "hover:bg-muted/80",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            isCurrent
              ? "bg-success text-success-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {index + 1}
        </span>
        <span className="truncate text-sm font-medium">{waypoint.name}</span>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold">{formatDistance(distanceM)}</div>
        <div className="text-[11px] text-muted-foreground">
          ETA {formatEta(durationS)}
        </div>
      </div>
    </div>
  );
}
