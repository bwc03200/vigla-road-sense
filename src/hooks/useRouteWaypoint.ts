import { useCallback } from "react";
import { toast } from "sonner";
import { useVigla } from "@/lib/vigla-store";
import { buildRouteState, fetchOsrmRouteVia } from "@/lib/routing";

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

/**
 * Adds a POI as an intermediate waypoint on the active route (or routes
 * straight to it when no route exists), then recalculates via OSRM.
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
      const destination = route
        ? route.destination
        : { lat: waypoint.lat, lng: waypoint.lng, label: waypoint.name };

      const points: [number, number][] = route
        ? [
            [position.lat, position.lng],
            [waypoint.lat, waypoint.lng],
            [destination.lat, destination.lng],
          ]
        : [
            [position.lat, position.lng],
            [waypoint.lat, waypoint.lng],
          ];

      const result = await fetchOsrmRouteVia(points);
      const newRoute = buildRouteState(destination, result, hazards);
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
      console.log("🍔 [ROUTE SUCCESS]", { eta, distance });
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

  return { addWaypoint };
}
