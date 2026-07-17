import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";
import {
  haversine,
  polylineLength,
  projectOnPolyline,
} from "@/lib/geo";
import { buildRouteState, fetchOsrmRoute } from "@/lib/routing";
import type { ActiveNavigation } from "@/types/vigla";

const OFF_ROUTE_M = 50;
const OFF_ROUTE_HOLD_MS = 8000;
const ARRIVAL_M = 30;
const RECALC_RETRY_MS = 10000;
const COORD_EPSILON = 0.0000001;
const DISTANCE_EPSILON_M = 0.1;

function nearlyEqual(a: number, b: number, epsilon = DISTANCE_EPSILON_M) {
  return Math.abs(a - b) <= epsilon;
}

function coordEqual(a: [number, number], b: [number, number]) {
  return (
    Math.abs(a[0] - b[0]) <= COORD_EPSILON &&
    Math.abs(a[1] - b[1]) <= COORD_EPSILON
  );
}

function coordsEqual(a: [number, number][], b: [number, number][]) {
  if (a.length !== b.length) return false;
  return a.every((coord, index) => coordEqual(coord, b[index]));
}

function navigationPatchChanged(
  navigation: ActiveNavigation,
  patch: Partial<ActiveNavigation>,
) {
  if (
    patch.remainingCoords &&
    !coordsEqual(navigation.remainingCoords, patch.remainingCoords)
  ) {
    return true;
  }
  if (
    patch.consumedCoords &&
    !coordsEqual(navigation.consumedCoords, patch.consumedCoords)
  ) {
    return true;
  }
  if (
    patch.distanceRemainingM != null &&
    !nearlyEqual(navigation.distanceRemainingM, patch.distanceRemainingM)
  ) {
    return true;
  }
  if (
    patch.durationRemainingS != null &&
    !nearlyEqual(navigation.durationRemainingS, patch.durationRemainingS)
  ) {
    return true;
  }
  if (
    patch.distanceToNextManeuverM != null &&
    !nearlyEqual(
      navigation.distanceToNextManeuverM,
      patch.distanceToNextManeuverM,
    )
  ) {
    return true;
  }
  if (
    patch.currentStepIndex != null &&
    navigation.currentStepIndex !== patch.currentStepIndex
  ) {
    return true;
  }
  if (
    patch.offRouteM != null &&
    !nearlyEqual(navigation.offRouteM, patch.offRouteM)
  ) {
    return true;
  }
  if (
    "offRouteSince" in patch &&
    navigation.offRouteSince !== patch.offRouteSince
  ) {
    return true;
  }
  if (
    patch.recalculating != null &&
    navigation.recalculating !== patch.recalculating
  ) {
    return true;
  }
  if (patch.arrived != null && navigation.arrived !== patch.arrived) {
    return true;
  }
  return false;
}

function patchNavigationIfChanged(
  navigation: ActiveNavigation,
  patch: Partial<ActiveNavigation>,
  patchNavigation: (patch: Partial<ActiveNavigation>) => void,
) {
  if (navigationPatchChanged(navigation, patch)) {
    patchNavigation(patch);
  }
}

/** Drives ActiveNavigation state from the user's live GPS position. */
export function useNavigationEngine() {
  const position = useVigla((s) => s.position);
  const route = useVigla((s) => s.route);
  const navigationActive = useVigla((s) => Boolean(s.navigation && !s.navigation.arrived));
  const patchNavigation = useVigla((s) => s.patchNavigation);
  const setRoute = useVigla((s) => s.setRoute);
  const setNavigation = useVigla((s) => s.setNavigation);

  const recalcInFlight = useRef(false);
  const lastRecalcAt = useRef(0);

  useEffect(() => {
    const {
      navigation,
      route: activeRoute,
      position: currentPosition,
      hazards,
    } = useVigla.getState();

    if (!navigationActive || !navigation || !activeRoute || !currentPosition) return;
    if (navigation.arrived) return;

    const coords = activeRoute.coords;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const proj = projectOnPolyline(currentPosition.lat, currentPosition.lng, coords);
    const totalLen = polylineLength(coords);
    const distanceRemainingM = Math.max(0, totalLen - proj.distanceAlongM);
    // Assume similar avg speed as OSRM baseline.
    const avgSpeed =
      activeRoute.durationS > 0 ? activeRoute.distanceM / activeRoute.durationS : 12;
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
      const d = haversine(
        currentPosition.lat,
        currentPosition.lng,
        s.location[0],
        s.location[1],
      );
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
      currentPosition.lat,
      currentPosition.lng,
      activeRoute.destination.lat,
      activeRoute.destination.lng,
    );
    if (destD < ARRIVAL_M) {
      patchNavigationIfChanged(
        navigation,
        {
          remainingCoords,
          consumedCoords,
          distanceRemainingM: 0,
          durationRemainingS: 0,
          distanceToNextManeuverM: 0,
          currentStepIndex: Math.max(0, steps.length - 1),
          offRouteM: proj.distanceToRouteM,
          offRouteSince: null,
          arrived: true,
        },
        patchNavigation,
      );
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

    patchNavigationIfChanged(
      navigation,
      {
        remainingCoords,
        consumedCoords,
        distanceRemainingM,
        durationRemainingS,
        distanceToNextManeuverM: distanceToNext,
        currentStepIndex: stepIdx,
        offRouteM: proj.distanceToRouteM,
        offRouteSince,
      },
      patchNavigation,
    );

    const shouldRecalc =
      offRouteSince != null &&
      now - offRouteSince > OFF_ROUTE_HOLD_MS &&
      !recalcInFlight.current &&
      now - lastRecalcAt.current > RECALC_RETRY_MS;

    if (shouldRecalc) {
      recalcInFlight.current = true;
      lastRecalcAt.current = now;
      patchNavigationIfChanged(navigation, { recalculating: true }, patchNavigation);
      fetchOsrmRoute(
        currentPosition.lat,
        currentPosition.lng,
        activeRoute.destination.lat,
        activeRoute.destination.lng,
      )
        .then((result) => {
          const newRoute = buildRouteState(activeRoute.destination, result, hazards);
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
          const latestNavigation = useVigla.getState().navigation;
          if (latestNavigation) {
            patchNavigationIfChanged(
              latestNavigation,
              { recalculating: false },
              patchNavigation,
            );
          }
        })
        .finally(() => {
          recalcInFlight.current = false;
        });
    }
  }, [
    position?.lat,
    position?.lng,
    position?.timestamp,
    route,
    navigationActive,
    patchNavigation,
    setNavigation,
    setRoute,
  ]);
}
