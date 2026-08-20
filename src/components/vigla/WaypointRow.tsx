import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RouteWaypoint } from "@/types/vigla";

interface WaypointRowProps {
  index: number;
  waypoint: RouteWaypoint;
  distanceM: number;
  durationS: number;
  isCurrent: boolean;
  onDelete?: (id: string) => void;
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
  onDelete,
}: WaypointRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const startPress = () => {
    if (!onDelete) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      navigator.vibrate?.(20);
      setShowMenu(true);
    }, 500);
  };
  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors select-none",
        isCurrent
          ? "bg-success/15 ring-1 ring-success/30"
          : "hover:bg-muted/80",
      )}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
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

      {showMenu && onDelete && (
        <div className="absolute right-2 top-full z-50 mt-1 flex flex-col gap-1 rounded-xl border border-border bg-popover p-1 shadow-lg">
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await onDelete(waypoint.id);
              setShowMenu(false);
              setDeleting(false);
            }}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => setShowMenu(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
