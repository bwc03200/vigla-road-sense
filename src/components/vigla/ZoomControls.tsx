import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { ZoomIn, ZoomOut } from "lucide-react";
import { vibrateTap } from "@/lib/haptics";

export function ZoomControls() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const min = map.getMinZoom();
  const max = map.getMaxZoom();

  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);

  const atMax = zoom >= max;
  const atMin = zoom <= min;

  return (
    <div className="pointer-events-none absolute bottom-24 right-3 z-[600] flex flex-col gap-2">
      <button
        type="button"
        aria-label="Zoomer"
        disabled={atMax}
        onClick={() => {
          vibrateTap();
          map.zoomIn();
        }}
        className="vigla-zoom-btn pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_4px_12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition active:scale-95 disabled:pointer-events-none disabled:opacity-40"
      >
        <ZoomIn className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Dézoomer"
        disabled={atMin}
        onClick={() => {
          vibrateTap();
          map.zoomOut();
        }}
        className="vigla-zoom-btn pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_4px_12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition active:scale-95 disabled:pointer-events-none disabled:opacity-40"
      >
        <ZoomOut className="h-5 w-5" />
      </button>
    </div>
  );
}
