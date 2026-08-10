import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { BRAND_ICONS } from "@/types/fastfoods";
import { useRouteWaypoint } from "@/hooks/useRouteWaypoint";
import type { ProximityAlert } from "@/hooks/useProximityAlerts";

interface Props {
  alert: ProximityAlert;
  onDismiss: (reason: "manual" | "added") => void;
  /** Moto Mode keeps a bottom panel — lift the card above it. */
  moto?: boolean;
}

function arrowFor(relativeBearing: number) {
  if (relativeBearing < 25 || relativeBearing > 335) return "↑";
  if (relativeBearing < 155) return "↗";
  if (relativeBearing < 205) return "↓";
  return "↖";
}

/** Auto-dismissing card shown when a POI enters the 300 m proximity ring. */
export function ProximityAlertCard({ alert, onDismiss, moto = false }: Props) {
  const { addWaypoint } = useRouteWaypoint();
  const [adding, setAdding] = useState(false);
  const { poi, distanceM, relativeBearing } = alert;

  const handleAdd = async () => {
    setAdding(true);
    await addWaypoint({
      name: poi.name,
      lat: poi.latitude,
      lng: poi.longitude,
      type: "restaurant",
      brand: poi.brand,
    });
    setAdding(false);
    onDismiss("added");
  };

  return (
    <div
      className={`pointer-events-auto fixed right-4 z-40 w-[280px] animate-[slide-in-right_0.3s_ease-out] rounded-lg border border-border bg-card/95 p-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)] backdrop-blur ${
        moto ? "bottom-[220px]" : "bottom-40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{BRAND_ICONS[poi.brand] ?? "🍔"}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{poi.name}</div>
          <div className="text-xs text-muted-foreground">
            {Math.round(distanceM)} m • à proximité
          </div>
          <div className="text-[11px] font-medium text-primary">
            {arrowFor(relativeBearing)} sur votre trajet
          </div>
        </div>
        <button
          type="button"
          aria-label="Ignorer"
          onClick={() => onDismiss("manual")}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Ajouter
        </button>
        <button
          type="button"
          onClick={() => onDismiss("manual")}
          className="flex-1 rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-muted-foreground transition active:scale-[0.98]"
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}
