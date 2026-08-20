import { Fuel, Loader2, Navigation, X } from "lucide-react";
import type { FuelPriceEntry } from "@/hooks/useGasStationPrices";
import type { GasStation } from "@/types/vigla";
import { formatDistance } from "@/lib/geo";

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function agoLabel(updatedAt: number | null) {
  if (!updatedAt) return null;
  const min = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));
  if (min < 60) return `Mis à jour il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `Mis à jour il y a ${h} h`;
  return `Mis à jour il y a ${Math.round(h / 24)} j`;
}

function PriceCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-center">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-base font-bold tabular-nums text-slate-900">
        {value != null ? `${value.toFixed(3)} €` : "—"}
      </div>
    </div>
  );
}

/**
 * P11-E — bottom sheet shown when tapping a fuel marker: live fuel prices
 * (SP95/E10 + Gazole) plus a one-tap "Ajouter à l'itinéraire" action that
 * reuses the existing click-to-route logic (P6).
 */
export function GasStationPricePopup({
  station,
  price,
  userPosition,
  routing = false,
  onRoute,
  onClose,
}: {
  station: GasStation;
  price: FuelPriceEntry | null;
  userPosition: { lat: number; lng: number } | null;
  routing?: boolean;
  onRoute: (s: GasStation) => void;
  onClose: () => void;
}) {
  const name = station.name ?? station.brand ?? "Station-service";
  const dist = userPosition
    ? distanceM(userPosition.lat, userPosition.lng, station.latitude, station.longitude)
    : null;
  const updated = agoLabel(price?.updatedAt ?? null);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[870] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#16A34A]/10 text-[#16A34A]">
            <Fuel className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">
              {[price?.name, dist != null ? formatDistance(dist) : null]
                .filter(Boolean)
                .join(" • ") || "Station-service"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <PriceCell label="Essence 95" value={price?.sp95 ?? null} />
          <PriceCell label="Gazole" value={price?.gazole ?? null} />
        </div>
        <div className="mt-1.5 text-center text-[11px] text-slate-400">
          {price ? (updated ?? "Prix officiels data.gouv.fr") : "Prix non disponibles"}
        </div>

        <button
          type="button"
          disabled={routing || !userPosition}
          onClick={() => {
            console.log("🚀 [P11-E] Ajouter à l'itinéraire", {
              station: name,
              lat: station.latitude,
              lng: station.longitude,
              sp95: price?.sp95 ?? null,
              gazole: price?.gazole ?? null,
            });
            onRoute(station);
          }}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B35] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(255,107,53,0.35)] transition active:scale-[0.98] disabled:opacity-60"
        >
          {routing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          Ajouter à l'itinéraire
        </button>
      </div>
    </div>
  );
}
