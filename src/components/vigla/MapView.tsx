import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { LocateFixed, MapPin, X, Loader2, Navigation } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { haversine, projectOnPolyline } from "@/lib/geo";
import { buildRouteState, fetchOsrmRoute } from "@/lib/routing";
import { UserMarker } from "@/components/vigla/UserMarker";
import { ZoomControls } from "@/components/vigla/ZoomControls";
import { HazardMarker } from "@/components/vigla/HazardMarker";
import { OfficialRadarCluster } from "@/components/vigla/OfficialRadarCluster";
import { useTrafficSignals, MIN_ZOOM_FOR_SIGNALS } from "@/hooks/useTrafficSignals";
import { useFastfoods } from "@/hooks/useFastfoods";
import { FastfoodCluster } from "@/components/vigla/FastfoodCluster";
import { SmartRestaurantsChip } from "@/components/vigla/SmartRestaurantsChip";
import { useProximityAlerts } from "@/hooks/useProximityAlerts";
import { ProximityAlertCard } from "@/components/vigla/ProximityAlertCard";




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

function FollowUser({ lat, lng, follow, recenterKey }: { lat: number; lng: number; follow: boolean; recenterKey: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      map.setView([lat, lng], 15);
      first.current = false;
      return;
    }
    if (follow) {
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [lat, lng, follow, map]);
  // Explicit recenter tap: pan to current position regardless of follow flag.
  useEffect(() => {
    if (recenterKey === 0) return;
    map.panTo([lat, lng], { animate: true, duration: 0.5 });
    // Intentionally exclude lat/lng: only trigger on tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return null;
}

function InteractionTracker() {
  const map = useMap();
  const setFollow = useVigla((s) => s.setMapFollowsUser);
  useMapEvents({
    dragstart: () => setFollow(false),
  });
  useEffect(() => {
    const el = map.getContainer();
    const off = () => setFollow(false);
    const onTouch = (e: TouchEvent) => { if (e.touches.length >= 2) setFollow(false); };
    el.addEventListener("wheel", off, { passive: true });
    el.addEventListener("touchstart", onTouch, { passive: true });
    return () => {
      el.removeEventListener("wheel", off);
      el.removeEventListener("touchstart", onTouch);
    };
  }, [map, setFollow]);
  return null;
}

function NavigationFollow({ lat, lng }: { lat: number; lng: number; heading?: number | null }) {
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
  // The map is always north-up. Heading is shown only by the UserMarker icon.
  useEffect(() => {
    const el = map.getContainer();
    el.style.transform = "";
    el.style.transition = "";
  }, [map]);
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
type PendingPick = { lat: number; lng: number; label: string | null };

function pendingIcon() {
  return L.divIcon({
    className: "vigla-pending-icon",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#FF6B35;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.35),0 0 0 3px #ffffff;color:white;font-size:14px;">📍</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

function MyLocationButton({ lat, lng, label, onRecenter }: { lat: number; lng: number; label: string; onRecenter: () => void }) {
  const map = useMap();
  return (
    <div className="pointer-events-none absolute bottom-56 right-3 z-[600]">
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          map.panTo([lat, lng], { animate: true, duration: 0.5 });
          onRecenter();
        }}
        className="vigla-zoom-btn pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_4px_12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition active:scale-95"
      >
        <LocateFixed className="h-5 w-5" />
      </button>
    </div>
  );
}

function TapToDestination({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      // Leaflet only fires `click` on the map itself: marker/popup clicks
      // don't propagate here, and a drag suppresses the click entirely.
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}


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
  const { t } = useTranslation();
  const position = useVigla((s) => s.position);
  const hazards = useVigla((s) => s.hazards);
  const officialRadars = useVigla((s) => s.officialRadars);
  const route = useVigla((s) => s.route);
  const navigation = useVigla((s) => s.navigation);
  const convoyMembers = useVigla((s) => s.convoyMembers);
  const mapTheme = useVigla((s) => s.preferences.map_theme);
  const motoMode = useVigla((s) => s.preferences.moto_mode);
  const autoRecenter = useVigla((s) => s.preferences.auto_recenter);
  const mapFollowsUser = useVigla((s) => s.mapFollowsUser);
  const setMapFollowsUser = useVigla((s) => s.setMapFollowsUser);
  const setRoute = useVigla((s) => s.setRoute);


  const hazardFilters = useVigla((s) => s.hazardFilters);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [pending, setPending] = useState<PendingPick | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [routeComputing, setRouteComputing] = useState(false);

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


  const showSignals = useVigla((s) => s.showTrafficSignals);
  const trafficSignals = useVigla((s) => s.trafficSignals);
  const signalBBox = useMemo(() => {
    if (!viewport || viewport.zoom < MIN_ZOOM_FOR_SIGNALS) return null;
    const latPad = (viewport.north - viewport.south) * 0.15;
    const lngPad = (viewport.east - viewport.west) * 0.15;
    return {
      south: viewport.south - latPad,
      north: viewport.north + latPad,
      west: viewport.west - lngPad,
      east: viewport.east + lngPad,
    };
  }, [viewport]);
  useTrafficSignals(signalBBox, viewport?.zoom ?? 0, showSignals);

  const visibleSignals = useMemo(() => {
    if (!showSignals || !signalBBox) return [];
    return trafficSignals.filter(
      (s) =>
        s.latitude <= signalBBox.north &&
        s.latitude >= signalBBox.south &&
        s.longitude <= signalBBox.east &&
        s.longitude >= signalBBox.west,
    );
  }, [trafficSignals, signalBBox, showSignals]);

  const showFastfoods = useVigla((s) => s.showFastfoods);
  // Always query so the chip can appear/disappear based on real POI presence;
  // the toggle only controls whether markers render.
  const { fastfoods, isLoading: fastfoodsLoading, isFailing, retryManually } =
    useFastfoods(signalBBox, viewport?.zoom ?? 0, true);
  const inViewFastfoods = useMemo(() => {
    if (!signalBBox) return [];
    return fastfoods.filter(
      (f) =>
        f.latitude <= signalBBox.north &&
        f.latitude >= signalBBox.south &&
        f.longitude <= signalBBox.east &&
        f.longitude >= signalBBox.west,
    );
  }, [fastfoods, signalBBox]);
  const visibleFastfoods = showFastfoods ? inViewFastfoods : [];


  useEffect(() => {
    if (!showFastfoods) {
      console.log("🍔 [LAYER] FastFoods layer hidden");
    } else if (visibleFastfoods.length === 0) {
      console.log("🍔 [LAYER] enabled but 0 POIs in viewport", {
        fetched: fastfoods.length,
        zoom: viewport?.zoom,
        bbox: signalBBox,
      });
    } else {
      console.log("🍔 [LAYER] rendering", visibleFastfoods.length, "markers");
    }
  }, [showFastfoods, visibleFastfoods.length, fastfoods.length, viewport?.zoom, signalBBox]);


  const center: [number, number] = position ? [position.lat, position.lng] : [48.8566, 2.3522];
  const navActive = !!navigation && !navigation.arrived;

  // Smart proximity alerts: POIs entering the 300 m ring during active nav.
  const { alert: proximityAlert, dismiss: dismissProximityAlert } =
    useProximityAlerts(inViewFastfoods, navActive);



  // Preload adjacent tiles (Leaflet native). Cut buffer down when the browser
  // reports Save-Data / slow connection so we don't burn mobile data.
  const saveData =
    typeof navigator !== "undefined" &&
    !!(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
  const tileKeepBuffer = saveData ? 1 : 4;

  const handleMapPick = useCallback(async (lat: number, lng: number) => {
    setPending({ lat, lng, label: null });
    setPendingLoading(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "json");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("zoom", "18");
      const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as { display_name?: string };
        setPending((p) => (p && p.lat === lat && p.lng === lng ? { ...p, label: data.display_name ?? null } : p));
      }
    } catch {
      /* offline / rate-limited: fall back to coords */
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const confirmPendingDestination = useCallback(async () => {
    if (!pending) return;
    if (!position) {
      toast.error(t("hazard.report.gpsUnavailable"));
      return;
    }
    setRouteComputing(true);
    try {
      const result = await fetchOsrmRoute(position.lat, position.lng, pending.lat, pending.lng);
      const label =
        pending.label ??
        `${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`;
      const state = buildRouteState(
        { lat: pending.lat, lng: pending.lng, label },
        result,
        hazards,
      );
      setRoute(state);
      setPending(null);
      toast.success(t("route.computed"), {
        description: t("route.computedDesc", {
          km: (state.distanceM / 1000).toFixed(1),
          n: state.hazardIds.length,
        }),
      });
    } catch {
      toast.error(t("route.serviceUnavailable"));
    } finally {
      setRouteComputing(false);
    }
  }, [pending, position, hazards, setRoute, t]);

  return (
    <>
    <MapContainer center={center} zoom={15} zoomControl={false} className="h-full w-full">
      <ViewportTracker onChange={setViewport} />
      <InteractionTracker />

      <TileLayer
        key={motoMode ? "moto-dark" : mapTheme}
        url={
          motoMode
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : mapTheme === "dark"
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
      {position && !route && !navActive && (
        <FollowUser
          lat={position.lat}
          lng={position.lng}
          follow={autoRecenter && mapFollowsUser}
          recenterKey={recenterKey}
        />
      )}
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
      {position && (!navActive || motoMode) && (
        <MyLocationButton
          lat={position.lat}
          lng={position.lng}
          label={t("map.recenter")}
          onRecenter={() => {
            setMapFollowsUser(true);
            setRecenterKey((k) => k + 1);
          }}
        />
      )}
      {!route && !navActive && <TapToDestination onPick={handleMapPick} />}
      {pending && (
        <Marker position={[pending.lat, pending.lng]} icon={pendingIcon()} />
      )}

      {route && !navActive && (
        <>
          <Polyline positions={route.coords} pathOptions={{ color: "#2563EB", weight: 6, opacity: 0.85 }} />
          <Marker position={[route.destination.lat, route.destination.lng]} icon={destinationIcon()} />
          <FitRoute coords={route.coords} />
          <FitRouteButton coords={route.coords} label={t("map.fitRoute")} />
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
      <OfficialRadarCluster radars={visibleSignals} variant="signal" dark={motoMode} />
      {showFastfoods && visibleFastfoods.length > 0 && (
        <FastfoodCluster
          pois={visibleFastfoods}
          zoom={viewport?.zoom ?? 13}
          dark={motoMode || mapTheme === "dark"}
        />
      )}
      {convoyMembers
        .filter((m) => m.last_lat != null && m.last_lng != null)
        .map((m) => (
          <Marker
            key={m.id}
            position={[m.last_lat!, m.last_lng!]}
            icon={convoyMemberIcon(m.display_name)}
          />
        ))}
      <div className="pointer-events-none absolute left-3 top-[8.5rem] z-[600] flex">
        <SmartRestaurantsChip
          count={inViewFastfoods.length}
          isLoading={fastfoodsLoading}
          isFailing={isFailing}
          onRetry={retryManually}
        />

      </div>
    </MapContainer>
    {pending && (
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[860] flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF6B35]/10 text-[#FF6B35]">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {t("map.pickedPoint")}
              </div>
              <div className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-900">
                {pendingLoading && !pending.label ? (
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("common.loading")}
                  </span>
                ) : (
                  pending.label ?? `${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={() => setPending(null)}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            disabled={routeComputing || !position}
            onClick={confirmPendingDestination}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,107,53,0.35)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {routeComputing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {t("map.setAsDestination")}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
