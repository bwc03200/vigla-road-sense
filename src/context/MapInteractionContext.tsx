import React, { createContext, useContext, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useVigla } from "@/lib/vigla-store";
import { useRouteWaypoint } from "@/hooks/useRouteWaypoint";

/**
 * P6 REWRITE — centralized polyline click handling.
 *
 * A single capture-phase document listener owns every "tap on the route"
 * interaction. MapView only registers the active polyline coords + the Leaflet
 * map instance; no per-polyline event handlers remain.
 */

interface PolylinePoint {
  lat: number;
  lng: number;
  distance?: number;
}

interface LeafletMapLike {
  latLngToContainerPoint: (latlng: [number, number] | { lat: number; lng: number }) => {
    x: number;
    y: number;
  };
  containerPointToLatLng: (point: [number, number]) => { lat: number; lng: number };
  getContainer: () => HTMLElement;
}

interface MapInteractionContextType {
  registerPolyline: (coords: [number, number][]) => void;
  unregisterPolyline: () => void;
  addWaypointAtPoint: (lat: number, lng: number) => void;
  getCurrentRoute: () => [number, number][] | null;
  getClosestPointOnPolyline: (x: number, y: number) => PolylinePoint | null;
  setMapRef: (mapInstance: LeafletMapLike | null) => void;
  isListenerActive: boolean;
}

const MapInteractionContext = createContext<MapInteractionContextType | undefined>(undefined);

const HIT_RADIUS_PX = 30;

export function MapInteractionProvider({ children }: { children: React.ReactNode }) {
  const { addWaypoint } = useRouteWaypoint();
  const polylineRef = useRef<[number, number][] | null>(null);
  const mapRef = useRef<LeafletMapLike | null>(null);
  const listenerRef = useRef(false);
  const listenerFuncRef = useRef<((e: MouseEvent) => void) | null>(null);
  const busyRef = useRef(false);

  const getCurrentRoute = useCallback(() => polylineRef.current, []);

  const getClosestPointOnPolyline = useCallback(
    (clickX: number, clickY: number): PolylinePoint | null => {
      const coords = polylineRef.current;
      const map = mapRef.current;
      if (!coords || coords.length < 2 || !map) return null;

      const rect = map.getContainer().getBoundingClientRect();
      const px = clickX - rect.left;
      const py = clickY - rect.top;

      let closestDist = Infinity;
      let closestPoint: PolylinePoint | null = null;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = map.latLngToContainerPoint({ lat: coords[i][0], lng: coords[i][1] });
        const p2 = map.latLngToContainerPoint({ lat: coords[i + 1][0], lng: coords[i + 1][1] });
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / len2));
        const cx = p1.x + t * dx;
        const cy = p1.y + t * dy;
        const dist = Math.hypot(px - cx, py - cy);
        if (dist < closestDist) {
          closestDist = dist;
          const ll = map.containerPointToLatLng([cx, cy]);
          closestPoint = { lat: ll.lat, lng: ll.lng, distance: i + t };
        }
      }

      if (!closestPoint || closestDist > HIT_RADIUS_PX) {
        if (closestDist !== Infinity) {
          console.log("❌ [CLICK TOO FAR]", `${closestDist.toFixed(0)}px from polyline`);
        }
        return null;
      }

      console.log(
        "📌 [CLOSEST POINT FOUND]",
        `dist: ${closestDist.toFixed(0)}px, lat: ${closestPoint.lat.toFixed(4)}, lng: ${closestPoint.lng.toFixed(4)}`,
      );
      return closestPoint;
    },
    [],
  );

  const addWaypointAtPoint = useCallback(
    (lat: number, lng: number) => {
      console.log("✅ [WAYPOINT ADD ATTEMPT]", `${lat.toFixed(4)}, ${lng.toFixed(4)}`);

      const { route, position } = useVigla.getState();
      if (!route || route.coords.length < 2) {
        console.error("❌ [WAYPOINT ADD FAILED]", "Not navigating or no destination");
        toast.error("❌ Aucun itinéraire actif");
        return;
      }
      if (!position) {
        console.error("❌ [WAYPOINT ADD FAILED]", "GPS position unavailable");
        toast.error("❌ Position GPS indisponible");
        return;
      }
      if (busyRef.current) {
        console.warn("⚠️ [WAYPOINT ADD SKIPPED]", "creation already in progress");
        return;
      }

      const index = (route.waypoints ?? []).filter((w) => w.type !== "destination").length + 1;
      const name = `Point ${index}`;
      console.log("📍 [ROUTE UPDATE]", `waypoints: ${index}`);
      busyRef.current = true;

      void addWaypoint({ name, lat, lng, type: "waypoint" })
        .then((res) => {
          if (!res) {
            console.error("❌ [WAYPOINT ADD FAILED]", "route not updated");
            return;
          }
          const total = (useVigla.getState().route?.waypoints ?? []).filter(
            (w) => w.type !== "destination",
          ).length;
          console.log("🎯 [WAYPOINT ADDED]", `Total waypoints: ${total}`);
        })
        .finally(() => {
          busyRef.current = false;
        });
    },
    [addWaypoint],
  );

  const detachGlobalListener = useCallback(() => {
    if (listenerFuncRef.current) {
      document.removeEventListener("click", listenerFuncRef.current, true);
      listenerFuncRef.current = null;
      listenerRef.current = false;
      console.log("🔊 [GLOBAL LISTENER DETACHED]");
    }
  }, []);

  const attachGlobalListener = useCallback(() => {
    if (listenerFuncRef.current) return;
    console.log("🔊 [GLOBAL LISTENER ATTACHING]");

    const handleMapClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".leaflet-container")) return;
      // Ignore taps on markers, popups and map controls.
      if (target.closest(".leaflet-marker-icon, .leaflet-popup, .leaflet-control")) return;

      const closestPoint = getClosestPointOnPolyline(e.clientX, e.clientY);
      if (closestPoint) {
        console.log(
          "🎯 [POLYLINE CLICK DETECTED]",
          `lat: ${closestPoint.lat.toFixed(4)}, lng: ${closestPoint.lng.toFixed(4)}`,
        );
        addWaypointAtPoint(closestPoint.lat, closestPoint.lng);
      }
    };

    listenerFuncRef.current = handleMapClick;
    listenerRef.current = true;
    document.addEventListener("click", handleMapClick, true);
    console.log("🔊 [GLOBAL LISTENER ATTACHED]");
  }, [getClosestPointOnPolyline, addWaypointAtPoint]);

  const registerPolyline = useCallback(
    (coords: [number, number][]) => {
      console.log("🗺️ [POLYLINE REGISTERED]", `${coords.length} points`);
      polylineRef.current = coords;
      if (!listenerRef.current) attachGlobalListener();
    },
    [attachGlobalListener],
  );

  const unregisterPolyline = useCallback(() => {
    console.log("🗺️ [POLYLINE UNREGISTERED]");
    polylineRef.current = null;
    detachGlobalListener();
  }, [detachGlobalListener]);

  const setMapRef = useCallback((mapInstance: LeafletMapLike | null) => {
    mapRef.current = mapInstance;
    if (mapInstance) console.log("🗺️ [MAP INSTANCE REGISTERED]");
  }, []);

  useEffect(() => detachGlobalListener, [detachGlobalListener]);

  const value: MapInteractionContextType = {
    registerPolyline,
    unregisterPolyline,
    addWaypointAtPoint,
    getCurrentRoute,
    getClosestPointOnPolyline,
    setMapRef,
    isListenerActive: listenerRef.current,
  };

  return (
    <MapInteractionContext.Provider value={value}>{children}</MapInteractionContext.Provider>
  );
}

export function useMapInteraction() {
  const context = useContext(MapInteractionContext);
  if (!context) {
    throw new Error("useMapInteraction must be used within MapInteractionProvider");
  }
  return context;
}
