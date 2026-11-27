import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { MapPin, X, Loader2, Navigation } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { haversine, projectOnPolyline, routeBearingAt } from "@/lib/geo";
import { matchAlongRoute } from "@/lib/route-index";
import { useHudInset, useHudInsetValues } from "@/lib/hud-insets";
import { buildRouteState, fetchOsrmRoute } from "@/lib/routing";
import { vibrateConfirm } from "@/lib/haptics";
import { UserMarker } from "@/components/vigla/UserMarker";
import { MapControls, ROUTE_FIT_PADDING } from "@/components/vigla/MapControls";
import { PoiLayerToggles } from "@/components/vigla/PoiLayerToggles";
import { HazardMarker } from "@/components/vigla/HazardMarker";
import { OfficialRadarCluster } from "@/components/vigla/OfficialRadarCluster";
import { useTrafficSignals, MIN_ZOOM_FOR_SIGNALS } from "@/hooks/useTrafficSignals";
import { useGasStations, MIN_ZOOM_FOR_GAS_STATIONS } from "@/hooks/useGasStations";
import { GasStationMarkers } from "@/components/vigla/GasStationMarkers";
import { GasStationPricePopup } from "@/components/vigla/GasStationPricePopup";
import { useGasStationPrices } from "@/hooks/useGasStationPrices";
import type { GasStation } from "@/types/vigla";
import { useFastfoods, MIN_ZOOM_FOR_FASTFOODS } from "@/hooks/useFastfoods";
import { FastfoodCluster } from "@/components/vigla/FastfoodCluster";
import { SmartRestaurantsChip } from "@/components/vigla/SmartRestaurantsChip";
import { RestaurantDetailsPopup } from "@/components/vigla/RestaurantDetailsPopup";
import { ShowRestaurantPreview } from "@/components/vigla/ShowRestaurantPreview";

import { CityDisplay } from "@/components/vigla/CityDisplay";
import { useCityName } from "@/hooks/useCityName";
import { useProximityAlerts, type ProximityPOI } from "@/hooks/useProximityAlerts";
import { useMapInteraction } from "@/context/MapInteractionContext";
import { ProximityAlertCard } from "@/components/vigla/ProximityAlertCard";
import { ItineraryPanel } from "@/components/vigla/ItineraryPanel";
import { NavigationBannerBlue } from "@/components/vigla/NavigationBannerBlue"; // conservé pour réactivation éventuelle
import { ProximityPopupSheet } from "@/components/vigla/ProximityPopupSheet";
import { useHeadingLock } from "@/hooks/useHeadingLock";
import { useFootRouting } from "@/hooks/useFootRouting";
import { FootModePanel } from "@/components/vigla/FootModePanel";

import { useRouteWaypoint } from "@/hooks/useRouteWaypoint";
import { dlog } from "@/lib/debug";





// Radar icon builder is kept in OfficialRadarCluster (imperative cluster
// layer). The React <Marker> variant is no longer needed here.




/** Exposes the Leaflet map instance to the outer component. */
function MapRefCapture({
  mapRef,
  onMap,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  onMap?: (map: L.Map | null) => void;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    onMap?.(map);
    return () => {
      mapRef.current = null;
      onMap?.(null);
    };
  }, [map, mapRef, onMap]);
  return null;
}

/** P6: hands the Leaflet map instance to the centralized click handler. */
function MapInteractionBridge() {
  const map = useMap();
  const { setMapRef } = useMapInteraction();
  useEffect(() => {
    setMapRef(map as never);
    return () => setMapRef(null);
  }, [map, setMapRef]);
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

/** Small black dot marking an intermediate waypoint added by tapping the route. */
function waypointIcon() {
  return L.divIcon({
    className: "vigla-waypoint-icon",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#0F172A;box-shadow:0 2px 6px rgba(15,23,42,.4),0 0 0 3px #ffffff;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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

/**
 * Keeps the vehicle at the centre of the map stage while navigating.
 * Rotation is owned by useHeadingLock alone: this component used to run a
 * second, independent rotation loop on the same panes.
 */
function NavigationFollow({ lat, lng, follow }: { lat: number; lng: number; follow: boolean }) {
  const map = useMap();
  const firstFollow = useRef(true);
  const latestRef = useRef<[number, number]>([lat, lng]);
  latestRef.current = [lat, lng];
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    if (firstFollow.current) {
      // On nav start, zoom in once for a driving view.
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: false });
      firstFollow.current = false;
      return;
    }
    if (!follow) return;
    // Then just recenter, respecting whatever zoom the user chose.
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, follow, map]);

  // The stage is resized when navigation starts (see MapStage). Leaflet keeps
  // the top-left corner fixed on a resize, which would leave the vehicle
  // off-centre until the next GPS fix: recentre as soon as the size settles.
  useEffect(() => {
    const onResize = () => {
      if (!followRef.current) return;
      map.setView(latestRef.current, map.getZoom(), { animate: false });
    };
    map.on("resize", onResize);
    return () => {
      map.off("resize", onResize);
    };
  }, [map]);

  return null;
}

/**
 * After the rider pans or zooms away during navigation, hand the map back to
 * the vehicle once they have left it alone for a while — nobody should have
 * to find a "recentre" button with gloves on.
 */
function AutoResumeFollow({ following, onResume }: { following: boolean; onResume: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (following) return;
    let timer = window.setTimeout(onResume, 10_000);
    const rearm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onResume, 10_000);
    };
    map.on("dragstart zoomstart", rearm);
    return () => {
      window.clearTimeout(timer);
      map.off("dragstart zoomstart", rearm);
    };
  }, [following, map, onResume]);
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
    map.fitBounds(bounds, ROUTE_FIT_PADDING);
  }, [coords, map]);
  return null;
}

/** A bottom-docked card that tells the HUD how much room it takes. */
function DockedBottom({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useHudInset(ref, "bottom");
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

let routeHintShown = false;

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

/**
 * The map lives in a "stage" that is normally the size of the screen, and
 * grows into a square centred on the vehicle while navigating.
 *
 * Heading-up navigation rotates the map panes with CSS. Leaflet only loads
 * tiles for its own (unrotated) container, so a screen-sized container left
 * large blank wedges in the corners as soon as the map turned. A square whose
 * half-side reaches the farthest screen corner always covers the screen, at
 * any rotation. Its centre — the vehicle — is placed two thirds of the way
 * down the part of the screen that is actually visible between the top and
 * bottom panels, so most of what the rider sees is the road ahead.
 */
const VEHICLE_BAND_Y = 0.68;
/** The vehicle is never drawn lower than this fraction of the map height. */
const VEHICLE_MAX_Y = 0.8;

function MapStage({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  const clipRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const insets = useHudInsetValues(clipRef);

  useEffect(() => {
    const el = clipRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      // Hidden map tab: keep the last known size instead of collapsing.
      if (box.width === 0 || box.height === 0) return;
      setSize((prev) =>
        prev && prev.w === box.width && prev.h === box.height
          ? prev
          : { w: box.width, h: box.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let stage: React.CSSProperties = { left: 0, top: 0, width: "100%", height: "100%" };
  if (expanded && size) {
    const pivotX = size.w / 2;
    const top = Math.min(insets.top, size.h * 0.45);
    const bottom = Math.min(insets.bottom, size.h * 0.45);
    // Clamped so a bad measurement can never push the vehicle off-screen.
    const pivotY = Math.min(
      size.h * VEHICLE_MAX_Y,
      Math.max(size.h * (1 - VEHICLE_MAX_Y), top + (size.h - top - bottom) * VEHICLE_BAND_Y),
    );
    // Sized for the lowest allowed vehicle position, not the current one: the
    // stage then only MOVES when a panel changes height. Resizing it would
    // make Leaflet re-lay out its tiles in the middle of a manoeuvre.
    const reach = Math.ceil(Math.hypot(pivotX, size.h * VEHICLE_MAX_Y));
    stage = { left: pivotX - reach, top: pivotY - reach, width: reach * 2, height: reach * 2 };
  }
  return (
    <div ref={clipRef} className="vigla-map-clip absolute inset-0 overflow-hidden">
      <div className="vigla-map-stage absolute" style={stage}>
        {children}
      </div>
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

  const navActiveForRadars = !!navigation && !navigation.arrived;
  const routeCoordsForRadars = route?.coords ?? null;
  const nearbyOfficial = useMemo(() => {
    if (officialRadars.length === 0) return [];


    // Radars along the active route (always shown, regardless of viewport).
    // Matched once per route through the cached route index: the previous
    // version re-scanned every radar against the route on each GPS fix.
    const routeSet = new Map<string, typeof officialRadars[number]>();
    if (navActiveForRadars && routeCoordsForRadars && routeCoordsForRadars.length > 1) {
      for (const m of matchAlongRoute(routeCoordsForRadars, officialRadars, 500)) {
        routeSet.set(m.item.id, m.item);
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
  }, [officialRadars, viewport, navActiveForRadars, routeCoordsForRadars]);


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

  // Fuel stations (Overpass amenity=fuel) — same viewport-driven pattern.
  const showGasStations = useVigla((s) => s.showGasStations);
  const gasStations = useVigla((s) => s.gasStations);
  const gasBBox = useMemo(() => {
    if (!viewport || viewport.zoom < MIN_ZOOM_FOR_GAS_STATIONS) return null;
    const latPad = (viewport.north - viewport.south) * 0.15;
    const lngPad = (viewport.east - viewport.west) * 0.15;
    return {
      south: viewport.south - latPad,
      north: viewport.north + latPad,
      west: viewport.west - lngPad,
      east: viewport.east + lngPad,
    };
  }, [viewport]);
  useGasStations(gasBBox, viewport?.zoom ?? 0, showGasStations);
  const visibleGasStations = useMemo(() => {
    if (!showGasStations || !gasBBox) return [];
    return gasStations.filter(
      (g) =>
        g.latitude <= gasBBox.north &&
        g.latitude >= gasBBox.south &&
        g.longitude <= gasBBox.east &&
        g.longitude >= gasBBox.west,
    );
  }, [gasStations, gasBBox, showGasStations]);
  // P11-E: official fuel prices + selected station popup.
  const [gasPopup, setGasPopup] = useState<GasStation | null>(null);
  const { findPrice } = useGasStationPrices(
    position ? { lat: position.lat, lng: position.lng } : null,
    showGasStations,
    gasBBox,
  );

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
      dlog("🍔 [LAYER] FastFoods layer hidden");
    } else if (visibleFastfoods.length === 0) {
      dlog("🍔 [LAYER] enabled but 0 POIs in viewport", {
        fetched: fastfoods.length,
        zoom: viewport?.zoom,
        bbox: signalBBox,
      });
    } else {
      dlog("🍔 [LAYER] rendering", visibleFastfoods.length, "markers");
    }
  }, [showFastfoods, visibleFastfoods.length, fastfoods.length, viewport?.zoom, signalBBox]);


  const center: [number, number] = position ? [position.lat, position.lng] : [48.8566, 2.3522];
  const navActive = !!navigation && !navigation.arrived;

  // Smart proximity alerts: POIs entering the 300 m ring during active nav.
  const proximityPois = useMemo<ProximityPOI[]>(
    () => [
      ...inViewFastfoods.map((f) => ({
        id: f.id,
        latitude: f.latitude,
        longitude: f.longitude,
        name: f.name,
        brand: f.brand,
        kind: "restaurant" as const,
      })),
      ...visibleGasStations.map((g) => ({
        id: `gas-${g.id}`,
        latitude: g.latitude,
        longitude: g.longitude,
        name: g.name ?? "Station essence",
        kind: "gas_station" as const,
      })),
    ],
    [inViewFastfoods, visibleGasStations],
  );
  const { alert: proximityAlert, dismiss: dismissProximityAlert } =
    useProximityAlerts(proximityPois, navActive);

  // P1: selecting a restaurant → small preview first, then full details or route.
  const mapRef = useRef<L.Map | null>(null);
  // Heading lock: rotate the map so the direction of travel points up.
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const handleMapReady = useCallback((m: L.Map | null) => setMapInstance(m), []);

  // Every navigation starts locked on the vehicle, whatever was left over
  // from browsing the map beforehand.
  useEffect(() => {
    if (navActive) setMapFollowsUser(true);
  }, [navActive, setMapFollowsUser]);
  const resumeFollow = useCallback(() => setMapFollowsUser(true), [setMapFollowsUser]);
  const navFollowing = navActive && autoRecenter && mapFollowsUser;

  // Where the vehicle is drawn, and which way it points.
  //  - Position: snapped to the route while the fix is within ~28 m of it, so
  //    the arrow rides the road instead of wobbling beside it. Beyond that the
  //    true fix is shown, so a real deviation is never hidden.
  //  - Course: the bearing of the road just ahead when snapped. The raw GPS
  //    heading is missing at standstill and noisy at low speed, which made
  //    the map spin at every stop; it is only trusted off-route and moving.
  const speedKmh = useVigla((s) => s.speedKmh);
  const lastCourseRef = useRef<number | null>(null);
  const vehicle = useMemo(() => {
    if (!position) return null;
    let lat = position.lat;
    let lng = position.lng;
    let course: number | null = null;
    if (navActive && navigation && route && route.coords.length > 1) {
      // remainingCoords starts at the segment the engine last matched, so
      // only the next few segments of the route need checking. Projecting on
      // route.coords itself reuses its cached distances.
      const from = Math.max(0, route.coords.length - navigation.remainingCoords.length);
      const proj = projectOnPolyline(lat, lng, route.coords, from, from + 60);
      if (proj.distanceToRouteM <= 28) {
        lat = proj.point[0];
        lng = proj.point[1];
        course = routeBearingAt(route.coords, proj.distanceAlongM);
      }
    }
    if (course == null && position.heading != null && Number.isFinite(position.heading) && speedKmh >= 5) {
      course = position.heading;
    }
    if (course == null) course = lastCourseRef.current;
    return { lat, lng, course };
  }, [position, navActive, navigation, route, speedKmh]);
  useEffect(() => {
    if (vehicle?.course != null) lastCourseRef.current = vehicle.course;
  }, [vehicle?.course]);

  useHeadingLock(mapInstance, vehicle?.course ?? null, navFollowing);
  // Recalculates the active route with the car/foot OSRM profile on toggle.
  useFootRouting();
  const isFootMode = useVigla((s) => s.isFootMode);
  const sillaxeActive = motoMode && !isFootMode && navActive;
  const [poiRouting, setPoiRouting] = useState(false);
  const [poiPreview, setPoiPreview] = useState<(typeof inViewFastfoods)[number] | null>(null);
  const [poiPopup, setPoiPopup] = useState<{
    list: typeof inViewFastfoods;
    index: number;
  } | null>(null);
  // Turning the Restaurants layer off must also close any open POI card.
  useEffect(() => {
    if (!showFastfoods) {
      setPoiPreview(null);
      setPoiPopup(null);
    }
  }, [showFastfoods]);
  const openPoiPreview = useCallback(
    (poi: (typeof inViewFastfoods)[number]) => {
      dlog("🍔 [PREVIEW OPEN]", poi.name);
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
      dlog("🍔 [POPUP OPEN]", poi.name, `${index + 1}/${list.length}`);
      setPoiPopup({ list, index });
    },
    [inViewFastfoods],
  );
  /**
   * BLOCKER FIX — single source of truth for "tap POI → route + navigation".
   * Fetches OSRM, writes RouteState AND NavigationState so the blue nav
   * banner appears immediately.
   */
  const startRouteToPoi = useCallback(
    async (lat: number, lng: number, label: string) => {
      const from = useVigla.getState().position;
      if (!from) {
        console.error("🔴 [ROUTE FAILED] no GPS position");
        toast.error(t("hazard.report.gpsUnavailable"));
        return null;
      }

      // Immediate feedback: button disabled + spinner visible.
      dlog("🟢 [BUTTON DISABLED]");
      dlog("🟢 [SPINNER VISIBLE]");

      const t0 = performance.now();
      dlog(`🟢 [OSRM REQUEST START] ${label}`);

      // Slow-network toast if OSRM takes longer than 2.5 s.
      const slowThresholdMs = 2500;
      let slowToastShown = false;
      const slowTimeout = setTimeout(() => {
        slowToastShown = true;
        dlog(`🟢 [OSRM SLOW: >${(slowThresholdMs / 1000).toFixed(1)}s]`);
        dlog("🟢 [TOAST: Calcul en cours...]");
        toast.info("Calcul en cours...", {
          description: "Nous préparons votre itinéraire",
          duration: 4000,
        });
      }, slowThresholdMs);

      try {
        // 🟢 [FOOT MODE ROUTING START]
        const isFootModeNow = useVigla.getState().isFootMode;
        const profile = isFootModeNow ? "foot" : "car";
        dlog(`🗺️ [OSRM PROFILE] ${profile.toUpperCase()}`);
        const result = await fetchOsrmRoute(from.lat, from.lng, lat, lng, undefined, {
          profile,
        });
        clearTimeout(slowTimeout);

        const elapsed = (performance.now() - t0) / 1000;
        dlog(`🟢 [OSRM RESPONSE OK: ${elapsed.toFixed(1)}s]`);
        if (elapsed > slowThresholdMs / 1000 && !slowToastShown) {
          dlog(`🟢 [OSRM SLOW: >${(slowThresholdMs / 1000).toFixed(1)}s]`);
        }
        dlog(
          `🟢 [OSRM OK] ${label} — ${(result.distanceM / 1000).toFixed(1)}km / ${Math.round(result.durationS / 60)}min / ${result.coords.length} pts`,
        );
        const state = buildRouteState(
          { lat, lng, label },
          result,
          useVigla.getState().hazards,
          [
            {
              id: `destination-${Date.now()}`,
              type: "destination",
              name: label,
              lat,
              lon: lng,
            },
          ],
        );
        // 🟢 [EXTRACT FOOT STEPS]
        const footSteps = isFootModeNow ? state.steps : [];
        if (isFootModeNow) {
          dlog(`📋 [FOOT STEPS EXTRACTED] ${footSteps.length} steps`);
        }
        // 🟢 [ATOMIC STATE WRITE] — single setState so route, navigation and
        // footModeSteps can never be read out of sync by FootModePanel.
        useVigla.setState({
          route: state,
          footModeSteps: footSteps,
          navigation: {
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
          },
        });
        dlog("🟢 [ATOMIC STATE WRITE] route + navigation + footModeSteps synced");
        dlog(
          `🟢 [ROUTE CREATED] destination: ${label}, waypoints: ${state.waypoints.length}`,
        );
        dlog("🟢 [NAV BANNER CREATED] navigation active — banner visible");
        dlog("🟢 [TOAST: Route créée ✓]");
        toast.success("Route créée ✓", {
          description: `${label} • ${(state.distanceM / 1000).toFixed(1)} km • ${Math.round(state.durationS / 60)} min`,
        });
        vibrateConfirm();
        return state;
      } catch (err) {
        clearTimeout(slowTimeout);
        console.error("🔴 [ROUTE FAILED]", err);
        dlog("🟢 [TOAST: Erreur calcul]");
        toast.error("Erreur calcul", {
          description: t("route.serviceUnavailable"),
        });
        return null;
      }
    },
    [t, setRoute, setNavigation],
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
      dlog("🎯 [POI TAPPED]", poi.name);

      setPoiRouting(true);
      try {
        const state = await startRouteToPoi(poi.latitude, poi.longitude, poi.name);
        if (state) setPoiPopup(null);
      } finally {
        setPoiRouting(false);
      }
    },
    [inViewFastfoods, startRouteToPoi],
  );


  // P6: tap anywhere on the route polyline → add an intermediate waypoint there.
  const { addWaypoint } = useRouteWaypoint();
  const addingWaypointRef = useRef(false);
  // Immediate visual feedback: black dot where the user tapped.
  const [tapPoint, setTapPoint] = useState<[number, number] | null>(null);
  const addWaypointAt = useCallback(
    async (lat: number, lng: number) => {
      if (addingWaypointRef.current) {
        console.warn("⚠️ [P6] Waypoint creation already in progress — tap ignored");
        return;
      }
      const current = useVigla.getState().route;
      if (!current || current.coords.length < 2) {
        console.error("❌ [P6] No active route — cannot add waypoint");
        toast.error("❌ Aucun itinéraire actif");
        return;
      }
      if (!useVigla.getState().position) {
        console.error("❌ [P6] GPS position unavailable — cannot recalculate");
        toast.error("❌ Position GPS indisponible");
        return;
      }

      addingWaypointRef.current = true;
      setTapPoint([lat, lng]);
      const index = (current.waypoints ?? []).filter((w) => w.type !== "destination").length + 1;
      const name = `Point ${index}`;
      dlog(
        `🎯 [P6] Route tap → lat=${lat.toFixed(5)}, lng=${lng.toFixed(5)}, creating "${name}"`,
      );
      toast.info("🎯 Tap détecté sur la route", { duration: 1200 });

      try {
        const res = await addWaypoint({ name, lat, lng, type: "waypoint" });
        if (res) {
          const total =
            (useVigla.getState().route?.waypoints ?? []).filter((w) => w.type !== "destination")
              .length;
          dlog(`✅ [P6] Waypoint added. Total intermediate waypoints: ${total}`, res);
          toast.success(`📍 ${name} ajouté ! Total : ${total}`, {
            description: `ETA: ${res.eta} • ${res.distance}`,
            duration: 2500,
          });
          setTapPoint(null);
        } else {
          console.error("❌ [P6] addWaypoint returned null — route not updated");
          setTapPoint(null);
        }
      } catch (err) {
        console.error("❌ [P6] CRITICAL error while adding waypoint:", err);
        setTapPoint(null);
        toast.error("❌ Erreur création waypoint");
      } finally {
        addingWaypointRef.current = false;
      }
    },
    [addWaypoint],
  );
  void addWaypointAt;

  // P6 REWRITE: register the active polyline with the centralized click handler.
  const { registerPolyline, unregisterPolyline } = useMapInteraction();
  const activeCoords = navActive
    ? navigation?.remainingCoords ?? null
    : route?.coords ?? null;
  useEffect(() => {
    if (activeCoords && activeCoords.length > 1) {
      registerPolyline(activeCoords);
      return () => unregisterPolyline();
    }
  }, [activeCoords, registerPolyline, unregisterPolyline]);

  // Hint, once per session, that the route polyline is tappable. It used to
  // pop up on every single route, stacked on the "itinéraire calculé" toast.
  const routeReadyRef = useRef(false);
  useEffect(() => {
    const hasRoute = (route?.coords?.length ?? 0) > 1;
    if (hasRoute && !routeReadyRef.current) {
      routeReadyRef.current = true;
      if (!routeHintShown) {
        routeHintShown = true;
        toast.info("🔵 Itinéraire prêt — tapez la route pour ajouter une étape", { duration: 2500 });
      }
    } else if (!hasRoute) {
      routeReadyRef.current = false;
      setTapPoint(null);
    }
  }, [route?.coords]);

  // Click-to-route on a fuel station: direct route to the pump.
  const handleGasStationSelect = useCallback(
    async (station: { id: string; latitude: number; longitude: number; name: string | null }) => {
      const label = station.name ?? t("layers.gasStations");
      dlog("🎯 [POI TAPPED]", label);
      setPoiRouting(true);
      try {
        const state = await startRouteToPoi(station.latitude, station.longitude, label);
        if (state) setGasPopup(null);
      } finally {
        setPoiRouting(false);
      }
    },
    [t, startRouteToPoi, setGasPopup],
  );


  // P11-E: tapping a fuel marker opens the price popup instead of routing.
  const openGasPopup = useCallback((station: GasStation) => {
    dlog("⛽ [P11-E] station sélectionnée", station.name ?? station.id);
    setGasPopup(station);
  }, []);



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
    <MapStage expanded={navActive}>
    <MapContainer center={center} zoom={15} zoomControl={false} attributionControl={false} className="h-full w-full">
      <ViewportTracker onChange={setViewport} />

      <InteractionTracker />

      <TileLayer
        key="osm"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        subdomains={["a", "b", "c"]}
        keepBuffer={tileKeepBuffer}
        updateWhenIdle={saveData}
        maxZoom={21}
        maxNativeZoom={19}
        minZoom={2}
      />
      <InvalidateOnResize />
      <MapRefCapture mapRef={mapRef} onMap={handleMapReady} />
      <MapInteractionBridge />
      {position && !route && !navActive && (
        <FollowUser
          lat={position.lat}
          lng={position.lng}
          follow={autoRecenter && mapFollowsUser}
          recenterKey={recenterKey}
        />
      )}
      {vehicle && autoRecenter && navActive && (
        <NavigationFollow lat={vehicle.lat} lng={vehicle.lng} follow={mapFollowsUser} />
      )}
      {navActive && autoRecenter && (
        <AutoResumeFollow following={mapFollowsUser} onResume={resumeFollow} />
      )}

      {vehicle && <UserMarker lat={vehicle.lat} lng={vehicle.lng} heading={vehicle.course} />}

      {!route && !navActive && <TapToDestination onPick={handleMapPick} />}
      {pending && (
        <Marker position={[pending.lat, pending.lng]} icon={pendingIcon()} />
      )}

      {route && !navActive && (
        <>
          <Polyline positions={route.coords} pathOptions={{ color: "#FF6B35", weight: 6, opacity: 0.85 }} />
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
              pathOptions={sillaxeActive ? { className: "sillaxe-route", weight: 7, opacity: 0.95 } : { color: "#FF6B35", weight: 7, opacity: 0.95 }}
            />
          )}
          <Marker position={[route.destination.lat, route.destination.lng]} icon={destinationIcon()} />
        </>
      )}
      {/* Immediate black dot feedback on tap (P6). */}
      {tapPoint && (
        <CircleMarker
          center={tapPoint}
          radius={8}
          pathOptions={{ color: "#000000", fillColor: "#000000", weight: 2, opacity: 1, fillOpacity: 0.8 }}
        />
      )}
      {/* Intermediate waypoints added by tapping the route (P6). */}
      {route?.waypoints
        ?.filter((w) => w.type !== "destination")
        .map((w) => (
          <Fragment key={w.id}>
            <CircleMarker
              center={[w.lat, w.lon]}
              radius={8}
              pathOptions={{
                color: "#000000",
                fillColor: "#000000",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.5,
              }}
            />
            <Marker position={[w.lat, w.lon]} icon={waypointIcon()} />
          </Fragment>
        ))}





      {showHazards && nearbyHazards.map((h) => (
        <HazardMarker key={h.id} hazard={h} />
      ))}

      {!isFootMode && showGasStations && visibleGasStations.length > 0 && (
        <GasStationMarkers stations={visibleGasStations} onSelect={openGasPopup} />
      )}
      {!isFootMode && showOfficialRadars && <OfficialRadarCluster radars={nearbyOfficial} />}
      {showSignals && (
        <OfficialRadarCluster radars={visibleSignals} variant="signal" dark={motoMode} />
      )}
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
    </MapContainer>
    </MapStage>
    <a
      className="vigla-attribution"
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
    >
      © OpenStreetMap
    </a>
    <MapControls
      map={mapInstance}
      hasPosition={!!position}
      navActive={navActive}
      following={navActive ? navFollowing : mapFollowsUser}
      fitCoords={route && !navActive ? route.coords : null}
      onRecenter={() => {
        setMapFollowsUser(true);
        if (!navActive) setRecenterKey((k) => k + 1);
      }}
    />
    {showFastfoods && (
      <div className="vigla-chip-restaurants vigla-under-top pointer-events-none absolute left-3 top-[8.5rem] z-[600] flex">
        <SmartRestaurantsChip
          pois={inViewFastfoods}
          isLoading={fastfoodsLoading}
          isFailing={isFailing}
          onRetry={retryManually}
          onSelect={openPoiPreview}
          userPosition={position}
        />
      </div>
    )}
    <div className="vigla-under-top absolute right-3 top-[8.5rem] z-[700]">
      <PoiLayerToggles dark={motoMode || mapTheme === "dark"} />
    </div>
    {proximityAlert && (
      /* Auto-shown ~3.5 s sheet: name, type, fuel price and "Ajouter à
         l'itinéraire". Restaurants keep the compact card. */
      proximityAlert.poi.kind === "gas_station" ? (
        <ProximityPopupSheet
          key={proximityAlert.poi.id}
          alert={proximityAlert}
          onDismiss={dismissProximityAlert}
          moto={motoMode}
          priceLabel={(() => {
            const p = findPrice(
              proximityAlert.poi.latitude,
              proximityAlert.poi.longitude,
            );
            const v = p?.sp95 ?? p?.gazole;
            return v != null ? `${v.toFixed(2)}€/L ${p?.sp95 != null ? "Essence 95" : "Diesel"}` : null;
          })()}
        />
      ) : (
        <ProximityAlertCard
          key={proximityAlert.poi.id}
          alert={proximityAlert}
          onDismiss={dismissProximityAlert}
          moto={motoMode}
        />
      )
    )}
    {pending && (
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[860] flex justify-center px-4">
        <DockedBottom className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
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
        </DockedBottom>
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

    {gasPopup && (
      <GasStationPricePopup
        station={gasPopup}
        price={findPrice(gasPopup.latitude, gasPopup.longitude)}
        userPosition={position ? { lat: position.lat, lng: position.lng } : null}
        routing={poiRouting}
        onRoute={(s) => {
          void handleGasStationSelect(s);
        }}
        onClose={() => setGasPopup(null)}
      />
    )}
    {/* Pastille « En navigation » supprimée : l'info est dans la carte d'instruction. */}
    {navActive && isFootMode && <FootModePanel />}
    {navActive && !sillaxeActive && route && route.waypoints.length > 0 && <ItineraryPanel />}
    {/* Hidden while navigating: it sat underneath the instruction card. */}
    {!navActive && <CityDisplay city={cityName} />}
    </>
  );
}
