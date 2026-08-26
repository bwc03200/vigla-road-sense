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

const REVEAL_PX = 96;
const SWIPE_TRIGGER_PX = 48;

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
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!revealed) setConfirming(false);
  }, [revealed]);

  const onPointerDown = (x: number) => {
    if (!onDelete || deleting) return;
    startXRef.current = x;
    draggingRef.current = true;
  };

  const onPointerMove = (x: number) => {
    if (!draggingRef.current || startXRef.current === null) return;
    const dx = x - startXRef.current;
    if (dx < 0) setOffset(Math.max(dx, -REVEAL_PX));
    else if (revealed) setOffset(Math.min(-REVEAL_PX + dx, 0));
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    startXRef.current = null;
    const shouldReveal = offset <= -SWIPE_TRIGGER_PX;
    if (shouldReveal && !revealed) {
      console.log("🟢 [SWIPE-DELETE DETECTED]", waypoint.name);
      navigator.vibrate?.(15);
    }
    setRevealed(shouldReveal);
    setOffset(shouldReveal ? -REVEAL_PX : 0);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    console.log("🟢 [OSRM RECALC START]", `removing ${waypoint.name}`);
    await onDelete(waypoint.id);
    setDeleting(false);
    setRevealed(false);
    setOffset(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {onDelete && (
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className={cn(
            "absolute inset-y-0 right-0 flex w-24 flex-col items-center justify-center gap-0.5 bg-destructive text-destructive-foreground transition-opacity disabled:opacity-60",
            revealed ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px] font-semibold">
            {deleting ? "..." : confirming ? "Confirmer" : "Supprimer"}
          </span>
        </button>
      )}

      <div
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(
          "relative flex select-none items-center justify-between gap-3 rounded-xl px-4 py-3",
          draggingRef.current ? "" : "transition-[transform,background-color]",
          isCurrent ? "bg-success/15 ring-1 ring-success/30" : "bg-background hover:bg-muted/80",
        )}
        onTouchStart={(e) => onPointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => onPointerMove(e.touches[0].clientX)}
        onTouchEnd={onPointerUp}
        onTouchCancel={onPointerUp}
        onMouseDown={(e) => onPointerDown(e.clientX)}
        onMouseMove={(e) => onPointerMove(e.clientX)}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
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
          <div className="text-[11px] text-muted-foreground">ETA {formatEta(durationS)}</div>
        </div>
      </div>
    </div>
  );
}
