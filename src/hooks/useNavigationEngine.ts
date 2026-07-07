import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";
import {
  haversine,
  polylineLength,
  projectOnPolyline,
} from "@/lib/geo";
import { buildRouteState, fetchOsrmRoute } from "@/lib/routing";

const OFF_ROUTE_M = 50;
const OFF_ROUTE_HOLD_MS = 15000;
const ARRIVAL_M = 30;
const RECALC_RETRY_MS = 10000;

/** Drives ActiveNavigation state from the user's live GPS position. */
export function useNavigationEngine() {
  const position = useVigla((s) => s.position);
  const route = useVigla((s) => s.route);
  const navigation = useVigla((s) => s.navigation);
  const patchNavigation = useVigla((s) => s.patchNavigation);
  const setRoute = useVigla((s) => s.setRoute);
  const setNavigation = useVigla((s) => s.setNavigation);
  const hazards = useVigla((s) => s.hazards);

  const recalcInFlight = useRef(false);
  const lastRecalcAt = useRef(0);

  useEffect(() => {
    if (!navigation || !route || !position) return;
    if (navigation.arrived) return;

    const coords = route.coords;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const proj = projectOnPolyline(position.lat, position.lng, coords);
    const totalLen = polylineLength(coords);
    const distanceRemainingM = Math.max(0, totalLen - proj.distanceAlongM);
    // Assume similar avg speed as OSRM baseline.
    const avgSpeed = route.durationS > 0 ? route.distanceM / route.durationS : 12;
    const durationRemainingS =
      avgSpeed > 0 ? distanceRemainingM / avgSpeed : 0;

    // Split polyline into consumed / remaining at projected point.
    const consumedCoords: [number, number][] = [
      ...coords.slice(0, proj.segmentIndex + 1),
      proj.point,
    ];
    const remainingCoords: [number, number][] = [
      proj.point,
      ...coords.slice(proj.segmentIndex + 1),
    ];

    // Advance step index by finding the next step location ahead of projection.
    const steps = Array.isArray(navigation.steps) ? navigation.steps : [];
    let stepIdx = Math.min(navigation.currentStepIndex, Math.max(0, steps.length - 1));
    let distanceToNext = 0;
    for (let i = stepIdx; i < steps.length; i++) {
      const s = steps[i];
      if (!s || !Array.isArray(s.location) || s.location.length < 2) continue;
      const d = haversine(position.lat, position.lng, s.location[0], s.location[1]);
      if (d < 25 && i < steps.length - 1) {
        stepIdx = i + 1;
        continue;
      }
      distanceToNext = d;
      stepIdx = i;
      break;
    }

    // Arrival.
    const destD = haversine(
      position.lat,
      position.lng,
      route.destination.lat,
      route.destination.lng,
    );
    if (destD < ARRIVAL_M) {
      patchNavigation({
        remainingCoords,
        consumedCoords,
        distanceRemainingM: 0,
        durationRemainingS: 0,
        distanceToNextManeuverM: 0,
        currentStepIndex: Math.max(0, steps.length - 1),
        offRouteM: proj.distanceToRouteM,
        offRouteSince: null,
        arrived: true,
      });
      return;
    }

    // Off-route detection.
    let offRouteSince = navigation.offRouteSince;
    const now = Date.now();
    if (proj.distanceToRouteM > OFF_ROUTE_M) {
      if (offRouteSince == null) offRouteSince = now;
    } else {
      offRouteSince = null;
    }

    patchNavigation({
      remainingCoords,
      consumedCoords,
      distanceRemainingM,
      durationRemainingS,
      distanceToNextManeuverM: distanceToNext,
      currentStepIndex: stepIdx,
      offRouteM: proj.distanceToRouteM,
      offRouteSince,
    });

    const shouldRecalc =
      offRouteSince != null &&
      now - offRouteSince > OFF_ROUTE_HOLD_MS &&
      !recalcInFlight.current &&
      now - lastRecalcAt.current > RECALC_RETRY_MS;

    if (shouldRecalc) {
      recalcInFlight.current = true;
      lastRecalcAt.current = now;
      patchNavigation({ recalculating: true });
      fetchOsrmRoute(
        position.lat,
        position.lng,
        route.destination.lat,
        route.destination.lng,
      )
        .then((result) => {
          const newRoute = buildRouteState(route.destination, result, hazards);
          setRoute(newRoute);
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
        })
        .catch(() => {
          patchNavigation({ recalculating: false });
        })
        .finally(() => {
          recalcInFlight.current = false;
        });
    }
  }, [
    position,
    route,
    navigation,
    hazards,
    patchNavigation,
    setNavigation,
    setRoute,
  ]);
}
