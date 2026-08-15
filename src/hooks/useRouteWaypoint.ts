import { useCallback } from "react";
import { toast } from "sonner";
import { useVigla } from "@/lib/vigla-store";
import { buildRouteState, fetchOsrmRouteVia } from "@/lib/routing";
import type { RouteWaypoint } from "@/types/vigla";

export interface AddWaypointPayload {
  name: string;
  lat: number;
  lng: number;
  type: "restaurant" | "hazard";
  brand?: string;
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatEta(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

function makeWaypointId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Adds a POI as an intermediate waypoint on the active route (or routes
 * straight to it when no route exists), then recalculates via OSRM.
 * Each POI is appended to the persistent waypoints list; the destination
 * always remains the last waypoint.
 */
export function useRouteWaypoint() {
  const addWaypoint = useCallback(async (waypoint: AddWaypointPayload) => {
    console.log("🍔 [ROUTE] Adding waypoint:", waypoint);
    const { position, route, hazards, navigation, setRoute, setNavigation } =
      useVigla.getState();

    if (!position) {
      toast.error("Position GPS indisponible");
      console.log("🍔 [ROUTE ERROR]", "no-position");
      return null;
    }

    try {
      const isFirstWaypoint = !route;

      const newWaypoint: RouteWaypoint = {
        id: makeWaypointId(waypoint.type),
        type: isFirstWaypoint ? "destination" : "poi",
        name: waypoint.name,
        lat: waypoint.lat,
        lon: waypoint.lng,
      };

      // Migrate an old RouteState that has no waypoints array yet by
      // synthesising a destination waypoint from route.destination.
      let baseWaypoints: RouteWaypoint[] = route?.waypoints ?? [];
      if (route && baseWaypoints.length === 0) {
        baseWaypoints = [
          {
            id: makeWaypointId("destination"),
            type: "destination",
            name: route.destination.label,
            lat: route.destination.lat,
            lon: route.destination.lng,
          },
        ];
      }

      let nextWaypoints: RouteWaypoint[];
      if (isFirstWaypoint) {
        nextWaypoints = [newWaypoint];
      } else {
        // Insert the new POI just before the final destination waypoint.
        const destIndex = baseWaypoints.findIndex((w) => w.type === "destination");
        if (destIndex === -1) {
          nextWaypoints = [...baseWaypoints, newWaypoint];
        } else {
          nextWaypoints = [
            ...baseWaypoints.slice(0, destIndex),
            newWaypoint,
            ...baseWaypoints.slice(destIndex),
          ];
        }
      }

      const destinationWaypoint =
        nextWaypoints.find((w) => w.type === "destination") ??
        nextWaypoints[nextWaypoints.length - 1];

      const destination = {
        lat: destinationWaypoint.lat,
        lng: destinationWaypoint.lon,
        label: destinationWaypoint.name,
      };

      const points: [number, number][] = [
        [position.lat, position.lng],
        ...nextWaypoints.map((w) => [w.lat, w.lon] as [number, number]),
      ];

      const result = await fetchOsrmRouteVia(points);
      const newRoute = buildRouteState(destination, result, hazards, nextWaypoints);
      setRoute(newRoute);

      if (navigation && !navigation.arrived) {
        setNavigation({
          routeCoords: newRoute.coords,
          remainingCoords: newRoute.coords,
          consumedCoords: [],
          steps: newRoute.steps,
          currentStepIndex: 0,
          distanceRemainingM: newRoute.distanceM,
          durationRemainingS: newRoute.durationS,
          distanceToNextManeuverM: newRoute.steps[0]?.distanceMeters ?? 0,
          offRouteM: 0,
          offRouteSince: null,
          recalculating: false,
          arrived: false,
          startedAt: navigation.startedAt,
          alertsReceived: navigation.alertsReceived,
        });
      }

      const eta = formatEta(newRoute.durationS);
      const distance = formatDistance(newRoute.distanceM);
      console.log("🍔 [ROUTE SUCCESS]", { eta, distance, waypoints: nextWaypoints });
      toast.success(`✅ ${waypoint.name} ajouté`, {
        description: `ETA: ${eta} • ${distance}`,
      });
      return { eta, distance, route: newRoute };
    } catch (error) {
      console.log("🍔 [ROUTE ERROR]", error);
      toast.error("Erreur", {
        description: "Impossible d'ajouter le waypoint",
      });
      return null;
    }
  }, []);

  /**
   * P9: route DIRECTLY to a POI (it becomes the destination). Any previously
   * added intermediate waypoints are cleared.
   */
  const routeDirectToPOI = useCallback(async (poi: AddWaypointPayload) => {
    const { position, hazards, setRoute } = useVigla.getState();
    if (!position) {
      toast.error("Position GPS indisponible");
      console.log(`❌ [QUICK ROUTE FAILED] — POI: ${poi.name}, error: no-gps, modal remains open`);
      return null;
    }

    try {
      const destination = { lat: poi.lat, lng: poi.lng, label: poi.name };
      const waypoints: RouteWaypoint[] = [
        {
          id: makeWaypointId("destination"),
          type: "destination",
          name: poi.name,
          lat: poi.lat,
          lon: poi.lng,
        },
      ];

      const result = await fetchOsrmRouteVia([
        [position.lat, position.lng],
        [poi.lat, poi.lng],
      ]);
      const newRoute = buildRouteState(destination, result, hazards, waypoints);
      setRoute(newRoute);

      const eta = formatEta(newRoute.durationS);
      const distance = formatDistance(newRoute.distanceM);
      console.log(
        `🚀 [QUICK ROUTE TO POI] — POI: ${poi.name}, distance: ${distance}, destination set, navigation started`,
      );
      toast.success(`🚀 ${poi.name}`, { description: `ETA: ${eta} • ${distance}` });
      return { eta, distance, route: newRoute };
    } catch (error) {
      console.log(`❌ [QUICK ROUTE FAILED] — POI: ${poi.name}, error: ${String(error)}`);
      toast.error("Erreur", { description: "Itinéraire indisponible" });
      return null;
    }
  }, []);

  return { addWaypoint, routeDirectToPOI };
}

