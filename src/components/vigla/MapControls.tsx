import { useEffect, useState } from "react";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import { LocateFixed, Navigation2, ZoomIn, ZoomOut } from "lucide-react";
import { vibrateTap } from "@/lib/haptics";

interface Props {
  map: L.Map | null;
  /** Whether a GPS fix exists (the recenter button needs somewhere to go). */
  hasPosition: boolean;
  navActive: boolean;
  /** False once the user has panned away from their own position. */
  following: boolean;
  /** Route to frame with the "fit route" button; only while previewing it. */
  fitCoords: [number, number][] | null;
  onRecenter: () => void;
}

/** Padding that keeps a framed route clear of the top bar and the bottom card. */
export const ROUTE_FIT_PADDING = {
  paddingTopLeft: [48, 120] as [number, number],
  paddingBottomRight: [48, 190] as [number, number],
};

/**
 * Recenter, fit-route and zoom buttons, as ONE column.
 *
 * They used to be three separately positioned elements living inside the
 * Leaflet container, each with its own hard-coded offset — which is how the
 * fit-route button came to sit on top of the zoom buttons. A single flex
 * column cannot overlap itself, and living outside the map lets the map be
 * larger than the screen while it rotates (see MapView's stage).
 */
export function MapControls({ map, hasPosition, navActive, following, fitCoords, onRecenter }: Props) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 15);

  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);

  if (!map) return null;
  const atMax = zoom >= map.getMaxZoom();
  const atMin = zoom <= map.getMinZoom();
  const button =
    "vigla-zoom-btn vigla-map-btn pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-[0_4px_12px_rgba(15,23,42,0.18)] transition active:scale-95 disabled:pointer-events-none disabled:opacity-40";
  // While navigating the button only matters once the map has been moved
  // away; say so explicitly instead of showing a control that does nothing.
  const showRecenter = hasPosition && (!navActive || !following);

  return (
    <div className="vigla-map-controls pointer-events-none absolute right-3 z-[600] flex flex-col gap-2">
      {showRecenter && (
        <button
          type="button"
          aria-label={navActive ? t("navigation.recenter") : t("map.recenter")}
          onClick={() => {
            vibrateTap();
            onRecenter();
          }}
          className={`${button} vigla-ctl-locate${navActive ? " vigla-ctl-resume" : ""}`}
        >
          {navActive ? <Navigation2 className="h-5 w-5" /> : <LocateFixed className="h-5 w-5" />}
        </button>
      )}
      {fitCoords && fitCoords.length >= 2 && (
        <button
          type="button"
          aria-label={t("map.fitRoute")}
          onClick={() => {
            vibrateTap();
            const bounds = L.latLngBounds(fitCoords.map(([la, ln]) => L.latLng(la, ln)));
            map.fitBounds(bounds, { ...ROUTE_FIT_PADDING, animate: true });
          }}
          className={`${button} vigla-ctl-fit`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M3 8V5a2 2 0 0 1 2-2h3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </button>
      )}
      <button
        type="button"
        aria-label={t("map.zoomIn")}
        disabled={atMax}
        onClick={() => {
          vibrateTap();
          map.zoomIn();
        }}
        className={`${button} vigla-ctl-zoom-in`}
      >
        <ZoomIn className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={t("map.zoomOut")}
        disabled={atMin}
        onClick={() => {
          vibrateTap();
          map.zoomOut();
        }}
        className={`${button} vigla-ctl-zoom-out`}
      >
        <ZoomOut className="h-5 w-5" />
      </button>
    </div>
  );
}
