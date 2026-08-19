import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Navigation } from "lucide-react";
import { BRAND_COLORS, BRAND_ICONS, type FastfoodPOI } from "@/types/fastfoods";
import { haversine, formatDistance } from "@/lib/geo";

interface Details {
  address?: string;
  phone?: string;
  hours?: string;
}

const detailsCache = new Map<string, Details>();

async function fetchDetails(poi: FastfoodPOI): Promise<Details> {
  const cached = detailsCache.get(poi.id);
  if (cached) return cached;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${poi.latitude}&lon=${poi.longitude}&addressdetails=1&extratags=1`;
  // Hard timeout: without it a hanging geocoder leaves the sheet on "Chargement…" forever.
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("reverse failed");
  const json = (await res.json()) as {
    display_name?: string;
    extratags?: Record<string, string>;
  };
  const tags = json.extratags ?? {};
  const details: Details = {
    address: json.display_name,
    phone: tags["phone"] ?? tags["contact:phone"],
    hours: tags["opening_hours"],
  };
  detailsCache.set(poi.id, details);
  return details;
}

interface Props {
  pois: FastfoodPOI[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onRoute: (poi: FastfoodPOI) => void;
  userPosition?: { lat: number; lng: number } | null;
  routing?: boolean;
}

/**
 * Scrollable restaurant details sheet with prev/next (arrows + swipe)
 * navigation across the whole nearby list, without closing the sheet.
 */
export function RestaurantDetailsPopup({
  pois,
  index,
  onIndexChange,
  onClose,
  onRoute,
  userPosition,
  routing = false,
}: Props) {
  const poi = pois[index];
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const touchX = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!poi) return;
    let cancelled = false;
    setDetails(detailsCache.get(poi.id) ?? null);
    setLoading(!detailsCache.has(poi.id));
    scrollRef.current?.scrollTo({ top: 0 });
    fetchDetails(poi)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {
        if (!cancelled) setDetails({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [poi]);

  if (!poi) return null;

  const go = (delta: number) => {
    const next = (index + delta + pois.length) % pois.length;
    console.log("🍔 [POPUP NAV]", { from: pois[index]?.name, to: pois[next]?.name });
    onIndexChange(next);
  };

  const brandColor = BRAND_COLORS[poi.brand] ?? "#64748B";
  const distance = userPosition
    ? haversine(userPosition.lat, userPosition.lng, poi.latitude, poi.longitude)
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={poi.name}
      className="fixed inset-0 z-[950] flex flex-col bg-card"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 60px)" }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-1 border-b border-border px-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)" }}
      >
        <button
          type="button"
          aria-label="Restaurant précédent"
          onClick={() => go(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground active:scale-95 disabled:opacity-30"
          disabled={pois.length < 2}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-muted-foreground">
          {index + 1} / {pois.length}
        </span>
        <button
          type="button"
          aria-label="Restaurant suivant"
          onClick={() => go(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground active:scale-95 disabled:opacity-30"
          disabled={pois.length < 2}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:scale-95"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
            style={{ boxShadow: `0 0 0 2px ${brandColor}` }}
            aria-hidden="true"
          >
            {BRAND_ICONS[poi.brand] ?? "🍴"}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight text-foreground">{poi.name}</h2>
            <div className="text-xs capitalize text-muted-foreground">
              {poi.brand?.replace("_", " ") ?? "Fast-food"}
              {distance != null ? ` · ${formatDistance(distance)}` : ""}
            </div>
          </div>
        </div>

        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Adresse
            </dt>
            <dd className="mt-0.5 text-foreground">
              {loading && !details?.address ? "Chargement…" : (details?.address ?? "Non renseignée")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Téléphone
            </dt>
            <dd className="mt-0.5 text-foreground">
              {details?.phone ? (
                <a
                  href={`tel:${details.phone}`}
                  className="inline-flex min-h-[44px] items-center underline"
                >
                  {details.phone}
                </a>
              ) : loading ? (
                "Chargement…"
              ) : (
                "Non renseigné"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Horaires
            </dt>
            <dd className="mt-0.5 whitespace-pre-line text-foreground">
              {loading && !details?.hours ? "Chargement…" : (details?.hours ?? "Non renseignés")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Coordonnées
            </dt>
            <dd className="mt-0.5 text-foreground">
              {poi.latitude.toFixed(5)}, {poi.longitude.toFixed(5)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Sticky action */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={() => onRoute(poi)}
          disabled={routing}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#FF6B35] px-4 text-base font-bold text-white active:scale-[0.98] disabled:opacity-60"
        >
          <Navigation className="h-5 w-5" />
          {routing ? "Calcul de l'itinéraire…" : "Y aller"}
        </button>
      </div>
    </div>
  );
}

