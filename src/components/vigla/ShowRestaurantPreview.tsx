import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Navigation, X, Info } from "lucide-react";
import { BRAND_COLORS, BRAND_ICONS, type FastfoodPOI } from "@/types/fastfoods";
import { haversine, formatDistance } from "@/lib/geo";

interface Props {
  poi: FastfoodPOI;
  userPosition?: { lat: number; lng: number } | null;
  onDetails: () => void;
  onRoute: () => void;
  onClose: () => void;
}

/**
 * Small floating preview card for a tapped restaurant marker.
 * Click outside closes it; the map underneath stays fully interactive.
 */
export function ShowRestaurantPreview({
  poi,
  userPosition,
  onDetails,
  onRoute,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!cardRef.current || cardRef.current.contains(target)) return;
      onClose();
    };
    // Slight delay so the same tap that opened the preview doesn't close it
    // immediately on touch devices.
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler, { passive: true });
    }, 50);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose]);

  const brandColor = BRAND_COLORS[poi.brand] ?? "#64748B";
  const distance = userPosition
    ? haversine(userPosition.lat, userPosition.lng, poi.latitude, poi.longitude)
    : null;
  const typeLabel = poi.brand?.replace("_", " ") ?? "Fast-food";

  return (
    <div
      ref={cardRef}
      className="pointer-events-auto fixed inset-x-0 bottom-[5.5rem] z-[880] mx-auto w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)] ring-1 ring-black/5">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: brandColor }}
        />
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `${brandColor}15`,
              boxShadow: `inset 0 0 0 2px ${brandColor}30`,
            }}
            aria-hidden="true"
          >
            {BRAND_ICONS[poi.brand] ?? "🍽️"}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-extrabold leading-tight text-foreground">
              {poi.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                {typeLabel}
              </span>
              {distance != null && (
                <span className="rounded-full bg-vigla-orange/10 px-2 py-0.5 text-[11px] font-semibold text-vigla-orange">
                  {formatDistance(distance)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-95 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDetails}
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-muted text-sm font-bold text-foreground transition active:scale-[0.98]"
          >
            <Info className="h-4 w-4" />
            {t("fastfood.preview.details")}
          </button>
          <button
            type="button"
            onClick={onRoute}
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-vigla-orange text-sm font-bold text-white shadow-md transition active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4" />
            {t("fastfood.preview.route")}
          </button>
        </div>
      </div>
    </div>
  );
}
