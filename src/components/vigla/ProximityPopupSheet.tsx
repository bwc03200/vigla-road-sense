import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useRouteWaypoint } from "@/hooks/useRouteWaypoint";
import type { ProximityAlert } from "@/hooks/useProximityAlerts";

interface Props {
  alert: ProximityAlert;
  onDismiss: (reason: "manual" | "added") => void;
  /** Moto Mode keeps a bottom panel — lift the sheet above it. */
  moto?: boolean;
  /** Auto-close delay in ms. */
  autoCloseMs?: number;
}

/**
 * Bottom sheet shown when a restaurant or fuel station enters the 300 m ring
 * during active navigation. Auto-closes after ~3.5 s (timer resets on tap).
 */
export function ProximityPopupSheet({
  alert,
  onDismiss,
  moto = false,
  autoCloseMs = 3500,
}: Props) {
  const { addWaypoint } = useRouteWaypoint();
  const [adding, setAdding] = useState(false);
  const [tick, setTick] = useState(0);
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { poi, distanceM } = alert;
  const icon = poi.kind === "gas_station" ? "⛽" : "🍔";
  const typeLabel = poi.kind === "gas_station" ? "Station essence" : "Restaurant";

  useEffect(() => {
    if (adding) return;
    closeRef.current = setTimeout(() => onDismiss("manual"), autoCloseMs);
    return () => {
      if (closeRef.current) clearTimeout(closeRef.current);
    };
  }, [adding, autoCloseMs, onDismiss, tick]);

  const handleAdd = async () => {
    setAdding(true);
    await addWaypoint({
      name: poi.name,
      lat: poi.latitude,
      lng: poi.longitude,
      type: poi.kind === "gas_station" ? "gas_station" : "restaurant",
      brand: poi.brand,
    });
    console.log(`📍 [POI ADDED] ${poi.name} added to route`);
    setAdding(false);
    onDismiss("added");
  };

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 ${moto ? "bottom-[220px]" : "bottom-28"}`}
      onClick={() => setTick((n) => n + 1)}
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card/95 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.22)] backdrop-blur animate-[slide-in-right_0.25s_ease-out]">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-foreground">{poi.name}</div>
            <div className="text-xs text-muted-foreground">{typeLabel}</div>
            <div className="text-[11px] font-medium text-primary">
              À {Math.round(distanceM)}m de votre route
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => onDismiss("manual")}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#0066FF" }}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          🧭 Ajouter à l&apos;itinéraire
        </button>
      </div>
    </div>
  );
}
