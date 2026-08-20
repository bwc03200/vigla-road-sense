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
import { PoiLayerToggles } from "@/components/vigla/PoiLayerToggles";
import { HazardMarker } from "@/components/vigla/HazardMarker";
import { OfficialRadarCluster } from "@/components/vigla/OfficialRadarCluster";
import { useTrafficSignals, MIN_ZOOM_FOR_SIGNALS } from "@/hooks/useTrafficSignals";
import { useFastfoods, MIN_ZOOM_FOR_FASTFOODS } from "@/hooks/useFastfoods";
import { FastfoodCluster } from "@/components/vigla/FastfoodCluster";
import { SmartRestaurantsChip } from "@/components/vigla/SmartRestaurantsChip";
import { RestaurantDetailsPopup } from "@/components/vigla/RestaurantDetailsPopup";
import { ShowRestaurantPreview } from "@/components/vigla/ShowRestaurantPreview";
import { AddressSearchBox } from "@/components/vigla/AddressSearchBox";
import { CityDisplay } from "@/components/vigla/CityDisplay";
import { useCityName } from "@/hooks/useCityName";
import { useProximityAlerts } from "@/hooks/useProximityAlerts";
import { ProximityAlertCard } from "@/components/vigla/ProximityAlertCard";
import { ItineraryPanel } from "@/components/vigla/ItineraryPanel";





// Radar icon builder is kept in OfficialRadarCluster (imperative cluster
// layer). The React <Marker> variant is no longer needed here.




/** Exposes the Leaflet map instance to the outer component. */
function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
  return null;
}

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

function NavigationFollow({ lat, lng, heading }: { lat: number; lng: number; heading?: number | null }) {
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

  // Heading lock: rotate the map container so the direction of travel points
  // up. Debounced (200ms), jitter-filtered, eased over 2.5s, and reverted to
  // north-up smoothly when navigation stops or GPS heading is lost.
  const targetRef = useRef(0);
  const lastTargetAtRef = useRef(0);
  useEffect(() => {
    if (heading == null || !Number.isFinite(heading)) return;
    const now = Date.now();
    const delta = Math.abs(((heading - targetRef.current + 540) % 360) - 180);
    // GPS jitter: ignore rapid small-ish swings.
    if (now - lastTargetAtRef.current < 200 && delta < 15) return;
    lastTargetAtRef.current = now;
    targetRef.current = heading;
  }, [heading]);

  useEffect(() => {
    const el = map.getContainer();
    const panes = () =>
      [
        map.getPane("tilePane"),
        map.getPane("overlayPane"),
        map.getPane("shadowPane"),
        map.getPane("markerPane"),
        map.getPane("popupPane"),
      ].filter(Boolean) as HTMLElement[];

    let current = 0;
    let from = 0;
    let to = 0;
    let startedAt = performance.now();
    let raf = 0;
    const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const frame = (now: number) => {
      const target = targetRef.current;
      if (target !== to) {
        from = current;
        to = target;
        startedAt = now;
      }
      const p = Math.min(1, (now - startedAt) / 2500);
      const diff = ((to - from + 540) % 360) - 180;
      current = from + diff * easeInOutQuad(p);
      const rot = -current;
      // Rotate the map panes only, so floating UI (chips, buttons, HUD)
      // stays upright. Origin = the on-screen map centre.
      const origin = map.latLngToLayerPoint(map.getCenter());
      for (const pane of panes()) {
        pane.style.transformOrigin = `${origin.x}px ${origin.y}px`;
        pane.style.transform = `rotate(${rot.toFixed(2)}deg)`;
      }
      el.style.setProperty("--vigla-map-rot", `${rot.toFixed(2)}deg`);
      raf = requestAnimationFrame(frame);
    };
    el.classList.add("vigla-heading-lock");
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      el.classList.remove("vigla-heading-lock");
      for (const pane of panes()) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
      }
      el.style.removeProperty("--vigla-map-rot");
    };
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
    // The map often mounts before its container has final size; re-emit once
    // layout settles so the very first viewport is accurate (no zoom cycle
    // needed to trigger POI layers).
    const t1 = window.setTimeout(emit, 300);
    const t2 = window.setTimeout(emit, 1200);
    map.on("moveend zoomend zoomlevelschange resize load viewreset", emit);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.off("moveend zoomend zoomlevelschange resize load viewreset", emit);
    };
  }, [map, onChange]);
  return null;
}

/** Small read-out of the current zoom level (top-right of the map). */
function ZoomIndicator() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend zoom", update);
    return () => {
      map.off("zoomend zoom", update);
    };
  }, [map]);
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[600] rounded-md bg-white/85 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
      Zoom level: {Math.round(zoom)}
    </div>
  );
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
  const setNavigation = useVigla((s) => s.setNavigation);


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
  const showOfficialRadars = useVigla((s) => s.showOfficialRadars);
  const showHazards = useVigla((s) => s.showHazards);
  // FastFoods have their own (lower) zoom threshold than traffic signals, so
  // they get their own padded bbox — otherwise the chip only appeared once the
  // user crossed the signals threshold (13), which is why it needed cycles.
  const fastfoodBBox = useMemo(() => {
    if (!viewport || viewport.zoom < MIN_ZOOM_FOR_FASTFOODS) return null;
    const latPad = (viewport.north - viewport.south) * 0.15;
    const lngPad = (viewport.east - viewport.west) * 0.15;
    return {
      south: viewport.south - latPad,
      north: viewport.north + latPad,
      west: viewport.west - lngPad,
      east: viewport.east + lngPad,
    };
  }, [viewport]);
  const fastfoodsReady = !!fastfoodBBox;

  const { fastfoods, isLoading: fastfoodsLoading, isFailing, retryManually } =
    useFastfoods(fastfoodBBox, viewport?.zoom ?? 0, fastfoodsReady);
  const inViewFastfoods = useMemo(() => {
    if (!fastfoodBBox) return [];
    return fastfoods.filter(
      (f) =>
        f.latitude <= fastfoodBBox.north &&
        f.latitude >= fastfoodBBox.south &&
        f.longitude <= fastfoodBBox.east &&
        f.longitude >= fastfoodBBox.west,
    );
  }, [fastfoods, fastfoodBBox]);
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

  // P1: selecting a restaurant → small preview first, then full details or route.
  const mapRef = useRef<L.Map | null>(null);
  const [poiRouting, setPoiRouting] = useState(false);
  const [poiPreview, setPoiPreview] = useState<(typeof inViewFastfoods)[number] | null>(null);
  const [poiPopup, setPoiPopup] = useState<{
    list: typeof inViewFastfoods;
    index: number;
  } | null>(null);
  const openPoiPreview = useCallback(
    (poi: (typeof inViewFastfoods)[number]) => {
      console.log("🍔 [PREVIEW OPEN]", poi.name);
      setPoiPreview(poi);
    },
    [],
  );
  const openPoiPopup = useCallback(
    (poi: (typeof inViewFastfoods)[number]) => {
      const list = inViewFastfoods.length ? inViewFastfoods : [poi];
      const index = Math.max(
        0,
        list.findIndex((p) => p.id === poi.id),
      );
      console.log("🍔 [POPUP OPEN]", poi.name, `${index + 1}/${list.length}`);
      setPoiPopup({ list, index });
    },
    [inViewFastfoods],
  );
  const handleFastfoodSelect = useCallback(

    async (poi: (typeof inViewFastfoods)[number]) => {
      const cluster = inViewFastfoods.length ? inViewFastfoods : [poi];
      const lats = cluster.map((r) => r.latitude);
      const lons = cluster.map((r) => r.longitude);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ];
      mapRef.current?.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16,
        animate: true,
        duration: 0.5,
      });
      console.log("🎯 [POI TAPPED]", poi.name);

      if (!position) {
        toast.error(t("hazard.report.gpsUnavailable"));
        return;
      }
      setPoiRouting(true);
      try {
        const result = await fetchOsrmRoute(
          position.lat,
          position.lng,
          poi.latitude,
          poi.longitude,
        );
        const state = buildRouteState(
          { lat: poi.latitude, lng: poi.longitude, label: poi.name },
          result,
          hazards,
          [
            {
              id: `destination-${Date.now()}`,
              type: "destination",
              name: poi.name,
              lat: poi.latitude,
              lon: poi.longitude,
            },
          ],
        );
        setRoute(state);
        setNavigation({
          routeCoords: state.coords,
          remainingCoords: state.coords,
          consumedCoords: [],
          steps: state.steps,
          currentStepIndex: 0,
          distanceRemainingM: state.distanceM,
          durationRemainingS: state.durationS,
          distanceToNextManeuverM: state.steps[0]?.distanceMeters ?? 0,
          offRouteM: 0,
          offRouteSince: null,
          recalculating: false,
          arrived: false,
          startedAt: new Date().toISOString(),
          alertsReceived: 0,
        });
        console.log("🚀 [ROUTE STARTED]", poi.name);
        setPoiPopup(null);
      } catch {
        toast.error(t("route.serviceUnavailable"));
      } finally {
        setPoiRouting(false);
      }
    },
    [inViewFastfoods, position, t, hazards, setRoute, setNavigation],
  );

  const [addressRouting, setAddressRouting] = useState(false);
  const handleAddressSelect = useCallback(
    async (lat: number, lng: number, label: string) => {
      console.log("🎯 [ADDRESS SELECTED]", label);
      if (!position) {
        toast.error(t("hazard.report.gpsUnavailable"));
        return;
      }
      setAddressRouting(true);
      try {
        const result = await fetchOsrmRoute(position.lat, position.lng, lat, lng);
        const state = buildRouteState({ lat, lng, label }, result, hazards);
        setRoute(state);
        setNavigation({
          routeCoords: state.coords,
          remainingCoords: state.coords,
          consumedCoords: [],
          steps: state.steps,
          currentStepIndex: 0,
          distanceRemainingM: state.distanceM,
          durationRemainingS: state.durationS,
          distanceToNextManeuverM: state.steps[0]?.distanceMeters ?? 0,
          offRouteM: 0,
          offRouteSince: null,
          recalculating: false,
          arrived: false,
          startedAt: new Date().toISOString(),
          alertsReceived: 0,
        });
        console.log("🚀 [ROUTE STARTED]", label);
      } catch {
        toast.error(t("route.serviceUnavailable"));
      } finally {
        setAddressRouting(false);
      }
    },
    [position, t, hazards, setRoute, setNavigation],
  );


  const cityName = useCityName(position?.lat, position?.lng);

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
      <ZoomIndicator />

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
      <MapRefCapture mapRef={mapRef} />
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




      {showHazards && nearbyHazards.map((h) => (
        <HazardMarker key={h.id} hazard={h} />
      ))}

      {showOfficialRadars && <OfficialRadarCluster radars={nearbyOfficial} />}
      <OfficialRadarCluster radars={visibleSignals} variant="signal" dark={motoMode} />
      {showFastfoods && visibleFastfoods.length > 0 && (
        <FastfoodCluster
          pois={visibleFastfoods}
          zoom={viewport?.zoom ?? 13}
          dark={motoMode || mapTheme === "dark"}
          onSelect={openPoiPreview}
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
      <div className="pointer-events-none absolute left-3 top-[4.5rem] z-[700] flex">
        <AddressSearchBox
          onSelect={handleAddressSelect}
          routing={addressRouting}
          center={
            viewport
              ? {
                  lat: (viewport.north + viewport.south) / 2,
                  lng: (viewport.east + viewport.west) / 2,
                }
              : null
          }
          zoom={viewport?.zoom}
          dark={motoMode || mapTheme === "dark"}
        />
      </div>
      <div className="pointer-events-none absolute left-3 top-[8.5rem] z-[600] flex">
        <SmartRestaurantsChip
          pois={inViewFastfoods}
          isLoading={fastfoodsLoading}
          isFailing={isFailing}
          onRetry={retryManually}
          onSelect={openPoiPreview}
          userPosition={position}
        />
      </div>
    </MapContainer>
    <div className="absolute right-3 top-[8.5rem] z-[700]">
      <PoiLayerToggles dark={motoMode || mapTheme === "dark"} />
    </div>
    {proximityAlert && (
      /* Anchored bottom-right (fixed, self-positioned): the top of the screen
         belongs to the instruction card + TopBar + hazard banner stack. */
      <ProximityAlertCard
        key={proximityAlert.poi.id}
        alert={proximityAlert}
        onDismiss={dismissProximityAlert}
        moto={motoMode}
      />
    )}
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
    {poiRouting && (
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[860] flex justify-center px-4">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.18)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      </div>
    )}

    {poiPreview && (
      <ShowRestaurantPreview
        poi={poiPreview}
        userPosition={position}
        onDetails={() => {
          setPoiPreview(null);
          openPoiPopup(poiPreview);
        }}
        onRoute={() => {
          setPoiPreview(null);
          void handleFastfoodSelect(poiPreview);
        }}
        onClose={() => setPoiPreview(null)}
      />
    )}

    {poiPopup && (
      <RestaurantDetailsPopup
        pois={poiPopup.list}
        index={poiPopup.index}
        onIndexChange={(i) => setPoiPopup((p) => (p ? { ...p, index: i } : p))}
        onClose={() => setPoiPopup(null)}
        onRoute={handleFastfoodSelect}
        userPosition={position}
        routing={poiRouting}
      />
    )}

    {navActive && route && route.waypoints.length > 0 && <ItineraryPanel />}
    <CityDisplay city={cityName} />
    </>
  );
}
