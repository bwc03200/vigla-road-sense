import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Navigation,
  MapPin,
  Phone,
  Clock,
  Compass,
  Globe,
  Star,
} from "lucide-react";
import { BRAND_COLORS, BRAND_ICONS, type FastfoodPOI } from "@/types/fastfoods";
import { haversine, formatDistance } from "@/lib/geo";

interface Details {
  address?: string;
  phone?: string;
  hours?: string;
  website?: string;
}

const detailsCache = new Map<string, Details>();

async function fetchDetails(poi: FastfoodPOI): Promise<Details> {
  const cached = detailsCache.get(poi.id);
  if (cached) return cached;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${poi.latitude}&lon=${poi.longitude}&addressdetails=1&extratags=1`;
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
    website: tags["website"] ?? tags["contact:website"],
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

  const hasPhone = !!details?.phone;
  const hasWebsite = !!details?.website;
  const typeLabel = poi.brand?.replace("_", " ") ?? "Fast-food";

  const phoneNumber = details?.phone?.replace(/\s/g, "") ?? "";
  const websiteUrl = (() => {
    const raw = details?.website?.trim() ?? "";
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return `https://${raw}`;
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={poi.name}
      className="fixed inset-0 z-[950] flex flex-col bg-background"
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
        className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)" }}
      >
        <button
          type="button"
          aria-label="Restaurant précédent"
          onClick={() => go(-1)}
          className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-full text-foreground active:scale-95 disabled:opacity-30"
          disabled={pois.length < 2}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-1">
          <span className="text-xs font-semibold text-vigla-orange">
            {index + 1} / {pois.length}
          </span>
          <span className="w-full truncate text-center text-sm font-bold text-foreground">
            {poi.name}
          </span>
        </div>
        <button
          type="button"
          aria-label="Restaurant suivant"
          onClick={() => go(1)}
          className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-full text-foreground active:scale-95 disabled:opacity-30"
          disabled={pois.length < 2}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-full text-muted-foreground active:scale-95"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border">
          <div
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundColor: brandColor }}
          />
          <div className="flex items-start gap-4">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm"
              style={{ backgroundColor: `${brandColor}15`, boxShadow: `inset 0 0 0 2px ${brandColor}30` }}
              aria-hidden="true"
            >
              {BRAND_ICONS[poi.brand] ?? "🍽️"}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold leading-tight text-foreground">
                {poi.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">
                  {typeLabel}
                </span>
                {distance != null && (
                  <span className="rounded-full bg-vigla-orange/10 px-2.5 py-1 text-xs font-semibold text-vigla-orange">
                    {formatDistance(distance)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-0.5 text-sm">
                {[...Array(4)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-vigla-orange text-vigla-orange"
                  />
                ))}
                <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                  4.0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="mt-4 space-y-3">
          {/* Address */}
          <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Adresse
                </dt>
                <dd className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                  {loading && !details?.address
                    ? "Chargement…"
                    : (details?.address ?? "Non renseignée")}
                </dd>
              </div>
            </div>
          </div>

          {/* Phone */}
          {(details?.phone || loading) && (
            <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Téléphone
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {loading && !details?.phone
                      ? "Chargement…"
                      : (details?.phone ?? "Non renseigné")}
                  </dd>
                </div>
              </div>
            </div>
          )}

          {/* Hours */}
          <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Horaires
                </dt>
                <dd className="mt-1 whitespace-pre-line text-sm font-medium leading-relaxed text-foreground">
                  {loading && !details?.hours
                    ? "Chargement…"
                    : (details?.hours ?? "Non renseignés")}
                </dd>
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Compass className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Coordonnées
                </dt>
                <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">
                  {poi.latitude.toFixed(5)}, {poi.longitude.toFixed(5)}
                </dd>
              </div>
            </div>
          </div>

          {/* Website */}
          {(details?.website || loading) && (
            <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                  <Globe className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Site web
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {details?.website ? (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center break-all text-vigla-orange underline"
                      >
                        {details.website}
                      </a>
                    ) : (
                      "Chargement…"
                    )}
                  </dd>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Secondary action buttons */}
        {(hasPhone || hasWebsite) && (
          <div className={`mt-5 grid gap-3 ${hasPhone && hasWebsite ? "grid-cols-2" : "grid-cols-1"}`}>
            {hasPhone && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = `tel:${phoneNumber}`;
                }}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
              >
                <Phone className="h-5 w-5" />
                Appeler
              </button>
            )}
            {hasWebsite && (
              <button
                type="button"
                onClick={() => {
                  window.open(websiteUrl, "_blank", "noopener,noreferrer");
                }}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
              >
                <Globe className="h-5 w-5" />
                Site web
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sticky primary action */}
      <div className="shrink-0 border-t border-border bg-card p-3">
        <button
          type="button"
          onClick={() => onRoute(poi)}
          disabled={routing}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-vigla-orange px-4 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-60"
        >
          <Navigation className="h-5 w-5" />
          {routing ? "Calcul de l'itinéraire…" : "Y aller"}
        </button>
      </div>
    </div>
  );
}
