import { useEffect, useRef } from "react";
import { toast } from "sonner";
import i18n from "@/i18n/i18n";
import { useVigla } from "@/lib/vigla-store";
import {
  haversine,
  polylineLength,
  projectOnPolyline,
} from "@/lib/geo";
import { buildRouteState, fetchOsrmRoute } from "@/lib/routing";
import { speak, cancelSpeech } from "@/lib/speech";
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
  const abortRef = useRef<AbortController | null>(null);
  const lastSegmentIdxRef = useRef(0);
  const lastOfflineToastAt = useRef(0);

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
    // Restrict search to segments at or ahead of last known projection so we
    // don't erroneously "jump" forward on routes that loop back near their start.
    const searchFrom = Math.min(lastSegmentIdxRef.current, coords.length - 2);
    const proj = projectOnPolyline(
      currentPosition.lat,
      currentPosition.lng,
      coords,
      searchFrom,
    );
    lastSegmentIdxRef.current = proj.segmentIndex;
    const totalLen = polylineLength(coords);
    const distanceRemainingM = Math.max(0, totalLen - proj.distanceAlongM);
    const avgSpeed =
      activeRoute.durationS > 0 ? activeRoute.distanceM / activeRoute.durationS : 12;
    const durationRemainingS =
      avgSpeed > 0 ? distanceRemainingM / avgSpeed : 0;

    const consumedCoords: [number, number][] = [
      ...coords.slice(0, proj.segmentIndex + 1),
      proj.point,
    ];
    const remainingCoords: [number, number][] = [
      proj.point,
      ...coords.slice(proj.segmentIndex + 1),
    ];

    const steps = Array.isArray(navigation.steps) ? navigation.steps : [];
    // Advance the "upcoming maneuver" step index based on distance traveled
    // ALONG the polyline. step[i].distanceMeters is the length of step i;
    // step[i] STARTS at cumulative sum of step[0..i-1]. We want to show the
    // next maneuver the driver hasn't yet reached.
    let stepIdx = Math.min(
      navigation.currentStepIndex,
      Math.max(0, steps.length - 1),
    );
    let distanceToNext = 0;
    if (steps.length > 0) {
      // stepStartDistances[i] = distance along route at which step i begins.
      const stepStartDistances: number[] = [0];
      let cumulative = 0;
      for (let i = 0; i < steps.length - 1; i++) {
        cumulative += Number.isFinite(steps[i]?.distanceMeters)
          ? steps[i].distanceMeters
          : 0;
        stepStartDistances.push(cumulative);
      }
      const traveled = proj.distanceAlongM;
      // Find the first upcoming step whose start we haven't crossed yet.
      // Never regress below the current index (protects against GPS jitter).
      let idx = Math.max(1, stepIdx);
      while (
        idx < steps.length - 1 &&
        traveled >= stepStartDistances[idx] - 5
      ) {
        idx += 1;
      }
      stepIdx = idx;
      distanceToNext = Math.max(0, stepStartDistances[stepIdx] - traveled);
      // Prefer straight-line distance to the maneuver point when available —
      // matches driver expectation (the banner counts down to the intersection).
      const s = steps[stepIdx];
      if (
        s &&
        Array.isArray(s.location) &&
        s.location.length >= 2 &&
        Number.isFinite(s.location[0]) &&
        Number.isFinite(s.location[1])
      ) {
        const d = haversine(
          currentPosition.lat,
          currentPosition.lng,
          s.location[0],
          s.location[1],
        );
        if (Number.isFinite(d)) distanceToNext = d;
      }
    }

    // Arrival: use haversine to the FINAL destination point AND require the
    // projected remaining polyline distance to be near zero. Both guards prevent
    // false positives from projection jumps or destination drift.
    const lastCoord = coords[coords.length - 1];
    const destD = haversine(
      currentPosition.lat,
      currentPosition.lng,
      activeRoute.destination.lat,
      activeRoute.destination.lng,
    );
    const lastCoordD = haversine(
      currentPosition.lat,
      currentPosition.lng,
      lastCoord[0],
      lastCoord[1],
    );
    const nearDest = Math.min(destD, lastCoordD) < ARRIVAL_M;
    if (nearDest && distanceRemainingM < 100) {
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

    // Show "recalcul en cours" as soon as we detect a sustained off-route,
    // not only after OSRM answers.
    const willRecalc =
      offRouteSince != null &&
      now - offRouteSince > OFF_ROUTE_HOLD_MS / 2;

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
        recalculating: navigation.recalculating || willRecalc,
      },
      patchNavigation,
    );

    const shouldRecalc =
      offRouteSince != null &&
      now - offRouteSince > OFF_ROUTE_HOLD_MS &&
      !recalcInFlight.current &&
      now - lastRecalcAt.current > RECALC_RETRY_MS;

    if (shouldRecalc) {
      // No network → don't attempt OSRM, keep the cached route + inform the user.
      const isOffline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      if (isOffline) {
        patchNavigationIfChanged(
          navigation,
          { recalculating: false },
          patchNavigation,
        );
        if (now - lastOfflineToastAt.current > 30_000) {
          lastOfflineToastAt.current = now;
          toast.warning(i18n.t("navigation.recalcOffline"));
        }
        return;
      }
      // Cancel any in-flight OSRM call and start a fresh one from current GPS.
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      recalcInFlight.current = true;
      lastRecalcAt.current = now;
      patchNavigationIfChanged(navigation, { recalculating: true }, patchNavigation);
      fetchOsrmRoute(
        currentPosition.lat,
        currentPosition.lng,
        activeRoute.destination.lat,
        activeRoute.destination.lng,
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          const newRoute = buildRouteState(activeRoute.destination, result, hazards);
          lastSegmentIdxRef.current = 0;
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
          import("@/lib/logger").then((m) =>
            m.logEvent("nav.recalc.success", "info", { distanceM: newRoute.distanceM }),
          );
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          const latestNavigation = useVigla.getState().navigation;
          if (latestNavigation) {
            patchNavigationIfChanged(
              latestNavigation,
              { recalculating: false },
              patchNavigation,
            );
          }
          import("@/lib/logger").then((m) =>
            m.logError(err, { source: "nav.recalc" }, "nav.recalc.fail"),
          );
        })
        .finally(() => {
          if (abortRef.current === controller) abortRef.current = null;
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

  // Reset per-navigation refs when a new nav starts / ends.
  useEffect(() => {
    if (!navigationActive) {
      lastSegmentIdxRef.current = 0;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      recalcInFlight.current = false;
    }
  }, [navigationActive]);
}

