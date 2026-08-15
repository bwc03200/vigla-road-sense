import { useEffect, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { haversine } from "@/lib/geo";
import { BRAND_ICONS, type FastfoodPOI } from "@/types/fastfoods";

interface QuickRoutePOIModalProps {
  isOpen: boolean;
  fastfoods: FastfoodPOI[];
  currentGPS: { lat: number; lng: number } | null;
  isLoading?: boolean;
  onClose: () => void;
  onRouteToPOI: (poi: FastfoodPOI) => void;
}

function formatKm(m: number | null) {
  if (m === null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/**
 * Bottom sheet listing nearby fast-food POIs sorted by distance.
 * One tap routes directly to the POI (destination, not waypoint).
 */
export function QuickRoutePOIModal({
  isOpen,
  fastfoods,
  currentGPS,
  isLoading = false,
  onClose,
  onRouteToPOI,
}: QuickRoutePOIModalProps) {
  const { t } = useTranslation();

  const rows = useMemo(() => {
    const withDistance = fastfoods.map((poi) => ({
      poi,
      distance: currentGPS
        ? haversine(currentGPS.lat, currentGPS.lng, poi.latitude, poi.longitude)
        : null,
    }));
    if (currentGPS) {
      withDistance.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }
    return withDistance;
  }, [fastfoods, currentGPS]);

  useEffect(() => {
    if (!isOpen) return;
    const closest = rows[0]?.distance;
    console.log(
      `🍽️ [QUICK ROUTE MODAL OPENED] — ${rows.length} restaurants loaded, closest: ${
        closest != null ? (closest / 1000).toFixed(1) : "—"
      } km`,
    );
  }, [isOpen, rows]);

  if (!isOpen) return null;

  const handleClose = () => {
    console.log("✕ [QUICK ROUTE MODAL CLOSED] — No selection");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
      />
      <div className="relative z-10 w-full max-w-[400px] animate-in slide-in-from-bottom rounded-t-3xl border border-slate-200 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.25)] duration-200 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            🍽️ {t("navigation.restaurants", "Restaurants")}
          </h2>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={handleClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
          {isLoading && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">—</div>
          ) : (
            rows.map(({ poi, distance }) => (
              <button
                key={poi.id}
                type="button"
                onClick={() => onRouteToPOI(poi)}
                className="flex min-h-12 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-100 active:bg-slate-200"
              >
                <span aria-hidden="true" className="text-lg">
                  {BRAND_ICONS[poi.brand] ?? "🍽️"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                  {poi.name}
                </span>
                <span className="shrink-0 text-sm text-slate-600">{formatKm(distance)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
