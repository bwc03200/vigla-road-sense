import { useEffect, useRef } from "react";
import { useFootModeStore } from "@/lib/foot-mode-store";
import { useVigla } from "@/lib/vigla-store";
import { buildRouteState, fetchOsrmRouteVia, getRoutingProfile } from "@/lib/routing";

/**
 * Recalculates the active route whenever the foot-mode toggle changes so the
 * OSRM profile (car ↔ foot) and displayed duration/distance stay in sync.
 * No-op when no route exists.
 */
export function useFootRouting() {
  const isFootMode = useFootModeStore((s) => s.isFootMode);
  const firstRun = useRef(true);

  useEffect(() => {
    // Skip the initial mount: routes are already created with the current
    // profile via getRoutingProfile() inside fetchOsrmRouteVia.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    console.log(`[TOGGLE SUCCESS] isFootMode: ${isFootMode}`);

    const { route, position, hazards, navigation, setRoute, setNavigation } =
      useVigla.getState();
    if (!route || !position) return;

    const profile = getRoutingProfile();
    if ((route.profile ?? "car") === profile) return;

    const waypoints = route.waypoints ?? [];
    const points: [number, number][] = [
      [position.lat, position.lng],
      ...waypoints.map((w) => [w.lat, w.lon] as [number, number]),
    ];
    if (points.length < 2) {
      points.push([route.destination.lat, route.destination.lng]);
    }

    console.log(`[FOOT MODE ROUTING] Recalculating route with profile: ${profile}`);

    let cancelled = false;
    (async () => {
      try {
        const result = await fetchOsrmRouteVia(points);
        if (cancelled) return;
        const newRoute = buildRouteState(route.destination, result, hazards, waypoints);
        setRoute(newRoute);
        console.log(
          `[ROUTE STATE UPDATED] profile: ${newRoute.profile}, duration: ${newRoute.durationS}s, distance: ${newRoute.distanceM}m`,
        );

        if (navigation && !navigation.arrived) {
          setNavigation({
            ...navigation,
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
          });
        }
      } catch (error) {
        console.log("[FOOT MODE ROUTING] Recalculation failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFootMode]);
}
