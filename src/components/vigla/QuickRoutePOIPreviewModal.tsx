import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BRAND_ICONS, type FastfoodPOI } from "@/types/fastfoods";

interface QuickRoutePOIPreviewModalProps {
  isOpen: boolean;
  selectedPOI: FastfoodPOI | null;
  /** Preview polyline coords (lat,lng) — null while loading or on error. */
  previewCoords: [number, number][] | null;
  /** Straight-line distance in meters (haversine from current GPS). */
  distanceM: number | null;
  /** ETA in seconds from OSRM. */
  etaS: number | null;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: (poi: FastfoodPOI) => void;
  onCancel: () => void;
}

function formatKm(m: number | null) {
  if (m == null || !Number.isFinite(m)) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatMin(s: number | null) {
  if (s == null || !Number.isFinite(s)) return "—";
  return `${Math.max(1, Math.round(s / 60))} min`;
}

/**
 * P9-bis: confirmation step between POI selection and routing.
 * The preview polyline itself is rendered by MapView.
 */
export function QuickRoutePOIPreviewModal({
  isOpen,
  selectedPOI,
  previewCoords,
  distanceM,
  etaS,
  isLoading = false,
  error = null,
  onConfirm,
  onCancel,
}: QuickRoutePOIPreviewModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !selectedPOI) return null;

  const canConfirm = !isLoading && !error && !!previewCoords;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label={t("navigation.cancel", "Annuler")}
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
      />
      <div className="relative z-10 w-[90%] max-w-[400px] rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.3)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("navigation.preview_route", "Aperçu de l'itinéraire")}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span aria-hidden="true" className="text-3xl">
            {BRAND_ICONS[selectedPOI.brand] ?? "🍽️"}
          </span>
          <h2 className="min-w-0 flex-1 text-xl font-bold text-slate-900">
            {selectedPOI.name}
          </h2>
        </div>

        <div className="mt-3 space-y-1 text-lg text-slate-700">
          {isLoading ? (
            <div className="flex items-center gap-2 text-base text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : error ? (
            <div className="text-base font-medium text-destructive">{error}</div>
          ) : (
            <>
              <div>{formatKm(distanceM)}</div>
              <div>{formatMin(etaS)}</div>
            </>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
          >
            {t("navigation.cancel", "Annuler")}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(selectedPOI)}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("navigation.confirm_route", "Confirmer la Route")}
          </button>
        </div>
      </div>
    </div>
  );
}
