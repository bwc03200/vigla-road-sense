import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props {
  lat: number;
  lng: number;
  heading: number | null;
}

// Normalize angle to (-180, 180].
function shortestDelta(from: number, to: number): number {
  let d = ((to - from) % 360 + 540) % 360 - 180;
  return d;
}

/**
 * User marker with client-side interpolation between GPS fixes.
 *
 * - Position is animated with requestAnimationFrame over the observed dt
 *   between two GPS updates (falls back to 1s for the very first move).
 * - Heading uses shortest-path rotation (handles 359° → 0° cleanly).
 * - Uses a stable Leaflet marker (never rebuilt) so CSS transforms compose
 *   correctly and the icon does not flicker on each React render.
 */
export function UserMarker({ lat, lng, heading }: Props) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Current animated values.
  const curLatRef = useRef(lat);
  const curLngRef = useRef(lng);
  const curHeadingRef = useRef(heading ?? 0);

  // Animation source/target/timing.
  const fromLatRef = useRef(lat);
  const fromLngRef = useRef(lng);
  const toLatRef = useRef(lat);
  const toLngRef = useRef(lng);
  const fromHeadingRef = useRef(heading ?? 0);
  const toHeadingRef = useRef(heading ?? 0);
  const startTsRef = useRef(0);
  const durationRef = useRef(1000);
  const lastFixTsRef = useRef(0);

  const mountedRef = useRef(true);
  const zoomingRef = useRef(false);

  // Create the Leaflet marker once.
  useEffect(() => {
    mountedRef.current = true;
    const icon = L.divIcon({
      className: "vigla-user-icon",
      html: `<div class="vigla-user-inner" style="transform: rotate(0deg);">
               <div class="vigla-user-arrow"></div>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const m = L.marker([lat, lng], { icon, interactive: false, keyboard: false });
    m.addTo(map);
    markerRef.current = m;
    innerRef.current = (m.getElement()?.querySelector(
      ".vigla-user-inner",
    ) as HTMLDivElement) ?? null;

    const onZoomStart = () => {
      zoomingRef.current = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    const onZoomEnd = () => {
      zoomingRef.current = false;
      if (!mountedRef.current || !markerRef.current) return;
      // Snap displayed position to the current interpolated value so Leaflet's
      // internal pixel origin (post-zoom) and our marker stay in sync.
      markerRef.current.setLatLng([curLatRef.current, curLngRef.current]);
      const needsResume =
        curLatRef.current !== toLatRef.current ||
        curLngRef.current !== toLngRef.current ||
        curHeadingRef.current !== toHeadingRef.current;
      if (needsResume && rafRef.current == null) {
        fromLatRef.current = curLatRef.current;
        fromLngRef.current = curLngRef.current;
        fromHeadingRef.current = curHeadingRef.current;
        startTsRef.current = performance.now();
        durationRef.current = Math.max(200, durationRef.current / 2);
        const step = (ts: number) => {
          if (!mountedRef.current || !markerRef.current || zoomingRef.current) {
            rafRef.current = null;
            return;
          }
          const t = Math.min(1, (ts - startTsRef.current) / durationRef.current);
          const latNow =
            fromLatRef.current + (toLatRef.current - fromLatRef.current) * t;
          const lngNow =
            fromLngRef.current + (toLngRef.current - fromLngRef.current) * t;
          const hdNow =
            fromHeadingRef.current +
            (toHeadingRef.current - fromHeadingRef.current) * t;
          curLatRef.current = latNow;
          curLngRef.current = lngNow;
          curHeadingRef.current = hdNow;
          markerRef.current.setLatLng([latNow, lngNow]);
          if (innerRef.current) {
            innerRef.current.style.transform = `rotate(${hdNow}deg)`;
          }
          if (t < 1) {
            rafRef.current = requestAnimationFrame(step);
          } else {
            rafRef.current = null;
          }
        };
        rafRef.current = requestAnimationFrame(step);
      }
    };
    map.on("zoomstart", onZoomStart);
    map.on("zoomend", onZoomEnd);

    return () => {
      mountedRef.current = false;
      map.off("zoomstart", onZoomStart);
      map.off("zoomend", onZoomEnd);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      markerRef.current = null;
      innerRef.current = null;
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Kick off a new interpolation whenever GPS gives us a new fix.
  useEffect(() => {
    if (!mountedRef.current || !markerRef.current) return;
    const now = performance.now();
    const nextHeading = heading ?? curHeadingRef.current;

    fromLatRef.current = curLatRef.current;
    fromLngRef.current = curLngRef.current;
    toLatRef.current = lat;
    toLngRef.current = lng;

    fromHeadingRef.current = curHeadingRef.current;
    // Shortest path rotation.
    toHeadingRef.current =
      curHeadingRef.current + shortestDelta(curHeadingRef.current, nextHeading);

    const dt = lastFixTsRef.current === 0 ? 800 : now - lastFixTsRef.current;
    // Clamp to a realistic GPS cadence so a stale fix doesn't freeze motion.
    durationRef.current = Math.min(2500, Math.max(400, dt));
    startTsRef.current = now;
    lastFixTsRef.current = now;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = (ts: number) => {
      if (!mountedRef.current || !markerRef.current || zoomingRef.current) {
        rafRef.current = null;
        return;
      }
      const t = Math.min(1, (ts - startTsRef.current) / durationRef.current);
      const latNow =
        fromLatRef.current + (toLatRef.current - fromLatRef.current) * t;
      const lngNow =
        fromLngRef.current + (toLngRef.current - fromLngRef.current) * t;
      const hdNow =
        fromHeadingRef.current +
        (toHeadingRef.current - fromHeadingRef.current) * t;

      curLatRef.current = latNow;
      curLngRef.current = lngNow;
      curHeadingRef.current = hdNow;

      markerRef.current.setLatLng([latNow, lngNow]);
      if (innerRef.current) {
        innerRef.current.style.transform = `rotate(${hdNow}deg)`;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    // Don't fight Leaflet's zoom animation — it will repositions the marker
    // itself via its own transform. Resume in the zoomend handler.
    if (!zoomingRef.current) {
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [lat, lng, heading]);

  return null;
}
