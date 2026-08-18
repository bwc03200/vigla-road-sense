import { Loader2, MapPin, Navigation, X } from "lucide-react";

export interface QuickRoutePreview {
  name: string;
  brand?: string;
  distanceM: number;
  durationS: number;
}

interface Props {
  preview: QuickRoutePreview | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * P9-preview: lightweight confirmation sheet shown after tapping a POI.
 * The candidate route is drawn on the map (semi-transparent blue) while this
 * modal is open; nothing is committed to the store until "Confirmer".
 */
export function QuickRoutePOIPreviewModal({ preview, loading, onConfirm, onCancel }: Props) {
  if (!preview && !loading) return null;

  const km = preview ? (preview.distanceM / 1000).toFixed(1) : null;
  const min = preview ? Math.max(1, Math.round(preview.durationS / 60)) : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[880] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">Aperçu itinéraire</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
              {preview?.name ?? "…"}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {loading || !preview ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Calcul de l'itinéraire…
                </span>
              ) : (
                <>
                  {km} km · {min} min
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 transition active:scale-[0.98]"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading || !preview}
            onClick={onConfirm}
            className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,107,53,0.35)] transition active:scale-[0.98] disabled:opacity-60"
          >
            <Navigation className="h-4 w-4" />
            Confirmer Route
          </button>
        </div>
      </div>
    </div>
  );
}
