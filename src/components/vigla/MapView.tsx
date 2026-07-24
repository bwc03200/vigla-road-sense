import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useVigla } from "@/lib/vigla-store";
import { haversine, projectOnPolyline } from "@/lib/geo";
import { UserMarker } from "@/components/vigla/UserMarker";
import { ZoomControls } from "@/components/vigla/ZoomControls";
import { HazardMarker } from "@/components/vigla/HazardMarker";
import { OfficialRadarCluster } from "@/components/vigla/OfficialRadarCluster";




// Radar icon builder is kept in OfficialRadarCluster (imperative cluster
// layer). The React <Marker> variant is no longer needed here.




function destinationIcon() {
  return L.divIcon({
    className: "vigla-destination-icon",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#0F172A;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.35),0 0 0 3px #ffffff;color:white;font-size:16px;">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function convoyMemberIcon(name: string) {
  const letter = (name.charAt(0) || "?").toUpperCase();
  // Rounded-square shape (border-radius 25%) so convoy members are visually
  // distinguishable from circular hazards even for colorblind users.
  return L.divIcon({
    className: "vigla-convoy-icon",
    html: `<div style="width:34px;height:34px;border-radius:9px;background:#7C3AED;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.35),0 0 0 3px #ffffff;color:white;font-weight:700;font-size:14px;">${letter}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      map.setView([lat, lng], 15);
      first.current = false;
    } else {
      // Preserve the user's current zoom — never override with a fixed value.
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [lat, lng, map]);
  return null;
}

function NavigationFollow({ lat, lng, heading }: { lat: number; lng: number; heading: number | null }) {
  const map = useMap();
  const firstFollow = useRef(true);
  useEffect(() => {
    if (firstFollow.current) {
      // On nav start, zoom in once for a driving view.
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });
      firstFollow.current = false;
    } else {
      // Then just recenter, respecting whatever zoom the user chose.
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  useEffect(() => {
    const el = map.getContainer();
    const h = heading ?? 0;
    el.style.transition = "transform 400ms ease-out";
    el.style.transform = `rotate(${-h}deg)`;
    return () => {
      el.style.transform = "";
    };
  }, [heading, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let raf1 = 0;
    let raf2 = 0;
    const invalidate = () => {
      // Double-rAF: wait for the CSS/layout change to settle before
      // asking Leaflet to recompute pixel bounds. { pan: false } so we
      // never fight the navigation follow logic — that hook re-centers
      // on the next GPS tick using the freshly-corrected size.
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          try {
            map.invalidateSize({ pan: false });
          } catch {
            /* map torn down */
          }
        });
      });
    };

    // Initial settle after mount (bottom tabs, dvh changes).
    const t = window.setTimeout(invalidate, 200);
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);

    // Generic safety net: any container size change triggers invalidate,
    // covering panels/toasts/banners that grow or shrink during navigation.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => invalidate());
      ro.observe(container);
    }

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
      if (ro) ro.disconnect();
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [map]);
  return null;
}


function FitRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map(([la, ln]) => L.latLng(la, ln)));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [coords, map]);
  return null;
}

function FitRouteButton({ coords, label }: { coords: [number, number][]; label: string }) {
  const map = useMap();
  if (coords.length < 2) return null;
  return (
    <div className="pointer-events-none absolute bottom-44 right-3 z-[600]">
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          const bounds = L.latLngBounds(coords.map(([la, ln]) => L.latLng(la, ln)));
          map.fitBounds(bounds, { padding: [60, 60], animate: true });
        }}
        className="vigla-zoom-btn pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_4px_12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M3 8V5a2 2 0 0 1 2-2h3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </button>
    </div>
  );
}


type Viewport = { north: number; south: number; east: number; west: number; zoom: number };

function ViewportTracker({ onChange }: { onChange: (v: Viewport) => void }) {
  const map = useMap();
  useEffect(() => {
    const emit = () => {
      const b = map.getBounds();
      onChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
        zoom: map.getZoom(),
      });
    };
    emit();
  }, [map, onChange]);
  useMapEvents({
    moveend: (e) => {
      const b = e.target.getBounds();
      onChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
        zoom: e.target.getZoom(),
      });
    },
    zoomend: (e) => {
      const b = e.target.getBounds();
      onChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
        zoom: e.target.getZoom(),
      });
    },
  });
  return null;
}

export function MapView() {
  const position = useVigla((s) => s.position);
  const hazards = useVigla((s) => s.hazards);
  const officialRadars = useVigla((s) => s.officialRadars);
  const route = useVigla((s) => s.route);
  const navigation = useVigla((s) => s.navigation);
  const convoyMembers = useVigla((s) => s.convoyMembers);
  const mapTheme = useVigla((s) => s.preferences.map_theme);
  const autoRecenter = useVigla((s) => s.preferences.auto_recenter);


  const hazardFilters = useVigla((s) => s.hazardFilters);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  const nearbyHazards = useMemo(() => {
    const filtered = hazards.filter((h) => hazardFilters[h.type] ?? true);
    if (!position) return filtered;
    return filtered.filter((h) => haversine(position.lat, position.lng, h.latitude, h.longitude) < 8000);
  }, [hazards, position, hazardFilters]);

  const MIN_ZOOM_FOR_RADARS = 10;
  const MAX_RADAR_MARKERS = 300;

  const nearbyOfficial = useMemo(() => {
    if (officialRadars.length === 0) return [];


    // Radars along the active navigation route (always shown, regardless of viewport).
    const routeSet = new Map<string, typeof officialRadars[number]>();
    const navActiveLocal = !!navigation && !navigation.arrived;
    if (navActiveLocal && navigation && navigation.remainingCoords.length > 1) {
      const coords = navigation.remainingCoords;
      // Sample every Nth coord to bound cost.
      const step = Math.max(1, Math.floor(coords.length / 200));
      for (const r of officialRadars) {
        for (let i = 0; i < coords.length; i += step) {
          const [la, ln] = coords[i];
          if (haversine(la, ln, r.latitude, r.longitude) < 500) {
            routeSet.set(r.id, r);
            break;
          }
        }
      }
    }

    if (!viewport) {
      return Array.from(routeSet.values());
    }
    if (viewport.zoom < MIN_ZOOM_FOR_RADARS) {
      return Array.from(routeSet.values());
    }

    // 15% margin around the visible bounds to avoid pop-in at edges.
    const latSpan = viewport.north - viewport.south;
    const lngSpan = viewport.east - viewport.west;
    const latPad = latSpan * 0.15;
    const lngPad = lngSpan * 0.15;
    const north = viewport.north + latPad;
    const south = viewport.south - latPad;
    const east = viewport.east + lngPad;
    const west = viewport.west - lngPad;

    const inView: typeof officialRadars = [];
    for (const r of officialRadars) {
      if (
        r.latitude <= north &&
        r.latitude >= south &&
        r.longitude <= east &&
        r.longitude >= west
      ) {
        inView.push(r);
        if (inView.length > MAX_RADAR_MARKERS + 1) break;
      }
    }

    // Merge route radars + capped viewport radars, dedup by id.
    const merged = new Map(routeSet);
    const capped = inView.slice(0, MAX_RADAR_MARKERS);
    for (const r of capped) merged.set(r.id, r);
    return Array.from(merged.values());
  }, [officialRadars, viewport, navigation]);


  const center: [number, number] = position ? [position.lat, position.lng] : [48.8566, 2.3522];
  const navActive = !!navigation && !navigation.arrived;

  // Preload adjacent tiles (Leaflet native). Cut buffer down when the browser
  // reports Save-Data / slow connection so we don't burn mobile data.
  const saveData =
    typeof navigator !== "undefined" &&
    !!(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
  const tileKeepBuffer = saveData ? 1 : 4;

  return (
    <MapContainer center={center} zoom={15} zoomControl={false} className="h-full w-full">
      <ViewportTracker onChange={setViewport} />

      <TileLayer
        key={mapTheme}
        url={
          mapTheme === "dark"
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        }
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains={["a", "b", "c", "d"]}
        keepBuffer={tileKeepBuffer}
        updateWhenIdle={saveData}
        maxZoom={19}
      />
      <InvalidateOnResize />
      {position && autoRecenter && !route && !navActive && <Recenter lat={position.lat} lng={position.lng} />}
      {position && autoRecenter && navActive && (
        <NavigationFollow lat={position.lat} lng={position.lng} heading={position.heading} />
      )}

      {position && (() => {
        // Light map-matching: while a route is active, snap the arrow to
        // the nearest point on the polyline as long as the raw fix is
        // within ~28m of the route. Beyond that we show the true position
        // so an actual deviation isn't hidden.
        let dispLat = position.lat;
        let dispLng = position.lng;
        if (navActive && navigation && navigation.remainingCoords.length > 1) {
          const proj = projectOnPolyline(
            position.lat,
            position.lng,
            navigation.remainingCoords,
          );
          if (proj.distanceToRouteM <= 28) {
            dispLat = proj.point[0];
            dispLng = proj.point[1];
          }
        }
        return <UserMarker lat={dispLat} lng={dispLng} heading={position.heading} />;
      })()}

      <ZoomControls />

      {route && !navActive && (
        <>
          <Polyline positions={route.coords} pathOptions={{ color: "#2563EB", weight: 6, opacity: 0.85 }} />
          <Marker position={[route.destination.lat, route.destination.lng]} icon={destinationIcon()} />
          <FitRoute coords={route.coords} />
        </>
      )}
      {navigation && navActive && route && (
        <>
          {navigation.consumedCoords.length >= 2 && (
            <Polyline
              positions={navigation.consumedCoords}
              pathOptions={{ color: "#94A3B8", weight: 5, opacity: 0.6 }}
            />
          )}
          {navigation.remainingCoords.length >= 2 && (
            <Polyline
              positions={navigation.remainingCoords}
              pathOptions={{ color: "#FF6B35", weight: 7, opacity: 0.95 }}
            />
          )}
          <Marker position={[route.destination.lat, route.destination.lng]} icon={destinationIcon()} />
        </>
      )}

      {nearbyHazards.map((h) => (
        <HazardMarker key={h.id} hazard={h} />
      ))}

      <OfficialRadarCluster radars={nearbyOfficial} />
      {convoyMembers
        .filter((m) => m.last_lat != null && m.last_lng != null)
        .map((m) => (
          <Marker
            key={m.id}
            position={[m.last_lat!, m.last_lng!]}
            icon={convoyMemberIcon(m.display_name)}
          />
        ))}
    </MapContainer>
  );
}
