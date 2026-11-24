import { useEffect, useRef } from "react";
import { toast } from "sonner";
import i18n from "@/i18n/i18n";
import { useVigla } from "@/lib/vigla-store";
import {
  cumulativeDistances,
  haversine,
  projectOnPolyline,
} from "@/lib/geo";
import { buildRouteState, fetchOsrmRouteVia } from "@/lib/routing";
import { speak, cancelSpeech } from "@/lib/speech";
import type { ActiveNavigation, RouteStep, RouteWaypoint } from "@/types/vigla";

const OFF_ROUTE_M = 50;
const OFF_ROUTE_HOLD_MS = 8000;
const ARRIVAL_M = 30;
const RECALC_RETRY_MS = 10000;
const COORD_EPSILON = 0.0000001;
const DISTANCE_EPSILON_M = 0.1;
/** Minimum stretch of route (m) searched ahead of the last known position. */
const PROJECTION_WINDOW_M = 400;
/** A waypoint counts as reached once the rider is this close to its leg end. */
const WAYPOINT_REACHED_M = 40;

/**
 * Distance at which the upcoming maneuver is announced ahead of time, and at
 * which the "now" call is made. Both scale with speed: 60 m is plenty of
 * warning at 30 km/h in town and none at all at 130 km/h on a motorway.
 */
export function announcementDistances(speedMps: number): { farM: number; nearM: number } {
  const v = Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;
  return {
    farM: Math.min(1500, Math.max(250, v * 18)),
    nearM: Math.min(160, Math.max(35, v * 4)),
  };
}

/** "Dans 300 mètres" / "Dans 1,2 kilomètres": rounded the way a person says it. */
function spokenDistance(m: number): { key: "m" | "km"; value: string } {
  if (m >= 950) {
    const km = Math.round(m / 100) / 10;
    const text = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return { key: "km", value: i18n.language?.startsWith("en") ? text : text.replace(".", ",") };
  }
  const step = m >= 300 ? 50 : 10;
  return { key: "m", value: String(Math.max(step, Math.round(m / step) * step)) };
}

/** Instruction as the second half of a sentence: no leading capital. */
function midSentence(instruction: string): string {
  return instruction.charAt(0).toLowerCase() + instruction.slice(1);
}

/**
 * Remaining travel time from per-step durations, so a route that mixes town
 * and motorway is not averaged into one wrong speed. Falls back to the
 * route-wide average when a (legacy / restored) route has no step durations.
 */
function remainingDuration(
  steps: RouteStep[],
  stepStarts: number[],
  traveledM: number,
  distanceRemainingM: number,
  fallbackSpeedMps: number,
): number {
  const fallback = fallbackSpeedMps > 0 ? distanceRemainingM / fallbackSpeedMps : 0;
  if (steps.length === 0 || steps.some((st) => !Number.isFinite(st.durationSeconds))) {
    return fallback;
  }
  let onStep = 0;
  for (let i = 0; i < steps.length; i++) {
    if (stepStarts[i] <= traveledM) onStep = i;
    else break;
  }
  const current = steps[onStep];
  const length = current.distanceMeters;
  const done = length > 0 ? Math.min(1, Math.max(0, (traveledM - stepStarts[onStep]) / length)) : 1;
  let total = (current.durationSeconds as number) * (1 - done);
  for (let i = onStep + 1; i < steps.length; i++) total += steps[i].durationSeconds as number;
  return Number.isFinite(total) ? total : fallback;
}

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

/** Stops of the active route that still lie ahead of `traveledM`. */
function pendingWaypoints(
  route: { waypoints?: RouteWaypoint[]; legs?: { distanceM: number }[] },
  traveledM: number,
): RouteWaypoint[] {
  const waypoints = Array.isArray(route.waypoints) ? route.waypoints : [];
  const legs = Array.isArray(route.legs) ? route.legs : [];
  // legs[i] ends at waypoints[i]; without matching legs we cannot tell which
  // stops are behind us, so keep them all rather than drop one by mistake.
  if (waypoints.length === 0 || legs.length !== waypoints.length) return waypoints;
  let reachedAt = 0;
  let firstPending = 0;
  for (let i = 0; i < waypoints.length; i++) {
    reachedAt += legs[i].distanceM;
    if (traveledM >= reachedAt - WAYPOINT_REACHED_M) firstPending = i + 1;
    else break;
  }
  return waypoints.slice(firstPending);
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
  const announcedStepRef = useRef<{ idx: number; far: boolean; near: boolean }>({
    idx: -1,
    far: false,
    near: false,
  });
  const arrivalAnnouncedRef = useRef(false);

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
    const cumulative = cumulativeDistances(coords);
    const totalLen = cumulative[cumulative.length - 1];
    const speedMps = Math.max(0, useVigla.getState().speedKmh / 3.6);

    // Search only a window of route ahead of the last projection. Searching
    // the whole remaining geometry let the position jump far ahead whenever
    // the route passes close to itself again (hairpins, interchange loops,
    // out-and-back roadbooks). A full forward search is kept as a fallback
    // for a real gap in fixes (tunnel, GPS drop-out).
    const searchFrom = Math.min(lastSegmentIdxRef.current, coords.length - 2);
    const windowM = Math.max(PROJECTION_WINDOW_M, speedMps * 15);
    let searchTo = searchFrom + 1;
    while (
      searchTo < coords.length - 1 &&
      cumulative[searchTo] - cumulative[searchFrom] < windowM
    ) {
      searchTo += 1;
    }
    let proj = projectOnPolyline(
      currentPosition.lat,
      currentPosition.lng,
      coords,
      searchFrom,
      searchTo,
    );
    if (proj.distanceToRouteM > OFF_ROUTE_M && searchTo < coords.length - 1) {
      const wide = projectOnPolyline(
        currentPosition.lat,
        currentPosition.lng,
        coords,
        searchFrom,
      );
      if (wide.distanceToRouteM <= OFF_ROUTE_M) proj = wide;
    }
    lastSegmentIdxRef.current = proj.segmentIndex;
    const distanceRemainingM = Math.max(0, totalLen - proj.distanceAlongM);
    const avgSpeed =
      activeRoute.durationS > 0 ? activeRoute.distanceM / activeRoute.durationS : 12;

    // IMPORTANT: the drawn geometry must NOT include the GPS-projected point.
    // Injecting proj.point made the head/tail vertex move (and the arrays get a
    // new identity) on every GPS tick, so Leaflet redrew the polyline ~1x/sec
    // with a jittering first vertex => visible "vibration". We slice strictly on
    // route vertices, so the arrays only change when the segment index changes,
    // and coordsEqual() below then keeps the previous references in the store.
    const consumedCoords: [number, number][] = coords.slice(0, proj.segmentIndex + 1);
    const remainingCoords: [number, number][] = coords.slice(proj.segmentIndex);


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
    // stepStartDistances[i] = distance along route at which step i begins.
    const stepStartDistances: number[] = [0];
    const traveled = Number.isFinite(proj.distanceAlongM) ? proj.distanceAlongM : 0;
    if (steps.length > 0) {
      let running = 0;
      for (let i = 0; i < steps.length - 1; i++) {
        running += Number.isFinite(steps[i]?.distanceMeters)
          ? steps[i].distanceMeters
          : 0;
        stepStartDistances.push(running);
      }
      // Find the first upcoming step whose start we haven't crossed yet.
      // Never regress below the current index (protects against GPS jitter),
      // but never exceed the last step either — a single-step route would
      // otherwise land on index 1 and produce a NaN countdown ("dans NaNkm").
      const lastIdx = steps.length - 1;
      let idx = Math.min(lastIdx, Math.max(1, stepIdx));
      while (idx < lastIdx && traveled >= stepStartDistances[idx] - 5) {
        idx += 1;
      }
      stepIdx = idx;
      // Count down ALONG the road. A straight-line distance to the maneuver
      // point reads short on anything that bends (roundabouts, hairpins,
      // slip roads), which made "dans 200 m" fire well before 200 m of road.
      const startAt = stepStartDistances[stepIdx] ?? 0;
      distanceToNext = Math.max(0, startAt - traveled);
    }
    const durationRemainingS = remainingDuration(
      steps,
      stepStartDistances,
      traveled,
      distanceRemainingM,
      avgSpeed,
    );

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
      if (useVigla.getState().preferences.voice_alerts && !arrivalAnnouncedRef.current) {
        arrivalAnnouncedRef.current = true;
        speak(i18n.t("navigation.instructions.arrive"), "high");
      }
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

    // Voice announcements for the upcoming maneuver: one ahead of time, one
    // at the maneuver, both at speed-dependent distances.
    if (useVigla.getState().preferences.voice_alerts && steps.length > 0) {
      const currentStep = steps[stepIdx];
      const instr = currentStep?.instruction;
      const isArrival = currentStep?.maneuverType === "arrive";
      const ann = announcedStepRef.current;
      if (ann.idx !== stepIdx) {
        ann.idx = stepIdx;
        ann.far = false;
        ann.near = false;
      }
      const { farM, nearM } = announcementDistances(speedMps);
      if (instr) {
        if (!ann.far && distanceToNext <= farM && distanceToNext > nearM * 1.6) {
          ann.far = true;
          const spoken = spokenDistance(distanceToNext);
          const key = isArrival
            ? spoken.key === "km" ? "voice.arriveInKm" : "voice.arriveIn"
            : spoken.key === "km" ? "voice.turnInKm" : "voice.turnIn";
          speak(
            i18n.t(key, { distance: spoken.value, instruction: midSentence(instr) }),
            "low",
          );
        } else if (!ann.near && distanceToNext <= nearM) {
          ann.near = true;
          ann.far = true;
          // The arrival itself is announced once, when actually reached.
          if (!isArrival) {
            speak(i18n.t("voice.turnNow", { instruction: midSentence(instr) }), "high");
          }
        }
      }
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
      // Keep the stops the rider has not reached yet: recalculating straight
      // to the final destination silently dropped every intermediate stop of
      // a roadbook or a "via" route the first time one left the road.
      const pending = pendingWaypoints(activeRoute, traveled);
      const via: [number, number][] = pending.map((w) => [w.lat, w.lon]);
      const lastVia = via[via.length - 1];
      if (
        !lastVia ||
        haversine(lastVia[0], lastVia[1], activeRoute.destination.lat, activeRoute.destination.lng) > 5
      ) {
        via.push([activeRoute.destination.lat, activeRoute.destination.lng]);
      }
      fetchOsrmRouteVia(
        [[currentPosition.lat, currentPosition.lng], ...via],
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          const newRoute = buildRouteState(
            activeRoute.destination,
            result,
            hazards,
            pending,
          );
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
          announcedStepRef.current = { idx: -1, far: false, near: false };
          if (useVigla.getState().preferences.voice_alerts) {
            speak(i18n.t("voice.recalculated"), "low");
          }
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
      announcedStepRef.current = { idx: -1, far: false, near: false };
      arrivalAnnouncedRef.current = false;
      cancelSpeech();
    }
  }, [navigationActive]);
}

