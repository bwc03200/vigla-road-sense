import type { HazardReport, RouteState, RouteStep } from "@/types/vigla";
import { distanceToPolyline } from "./geo";
import i18n from "@/i18n/i18n";
import { useFootModeStore } from "@/lib/foot-mode-store";

const ROUTE_HAZARD_RADIUS_M = 500;

export type RoutingProfile = "car" | "foot";

/** Average walking speed (m/s) ≈ 5 km/h, used to estimate foot durations. */
const FOOT_SPEED_MPS = 1.4;

/** Current OSRM profile derived from the foot-mode toggle. */
export function getRoutingProfile(): RoutingProfile {
  return useFootModeStore.getState().isFootMode ? "foot" : "car";
}

// NOTE: the public OSRM demo server does not reliably serve localized step
// text via a language query param, so we build instructions ourselves from
// the maneuver type/modifier and translate via i18next. Instruction text is
// snapshotted at route-fetch time; switching language mid-trip won't
// re-translate an already-computed route until it is recalculated.

interface OsrmManeuver {
  type: string;
  modifier?: string;
  location?: [number, number]; // [lng, lat]
  /** Exit number to take, on roundabout / rotary maneuvers. */
  exit?: number;
}
interface OsrmStep {
  distance: number;
  duration?: number;
  maneuver: OsrmManeuver;
  name?: string;
}

const ROUNDABOUT_TYPES = new Set(["roundabout", "rotary"]);
const ROUNDABOUT_EXIT_TYPES = new Set(["exit roundabout", "exit rotary"]);

const MANEUVER_KEY: Record<string, string> = {
  turn: "turn",
  "new name": "newName",
  depart: "depart",
  arrive: "arrive",
  merge: "merge",
  "on ramp": "onRamp",
  "off ramp": "offRamp",
  fork: "fork",
  "end of road": "endOfRoad",
  continue: "continue",
  roundabout: "roundabout",
  rotary: "roundabout",
  "roundabout turn": "roundaboutTurn",
  notification: "notification",
  "exit roundabout": "exitRoundabout",
  "exit rotary": "exitRoundabout",
};

function stepInstruction(s: OsrmStep, next?: OsrmStep): string {
  const t = i18n.t.bind(i18n);
  const typ = s.maneuver.type;
  const mod = s.maneuver.modifier;
  const name = s.name?.trim();
  // Shown while approaching the destination ("Dans 300 m — Arrivée à
  // destination"); the engine speaks "Vous êtes arrivé" once actually there.
  if (typ === "arrive") {
    return t("navigation.instructions.arriveAhead", {
      defaultValue: t("navigation.instructions.arrive"),
    });
  }
  // Roundabouts: what the rider needs is the exit number and the road they
  // leave on — not the ring's own name or a left/right hint.
  const exit = s.maneuver.exit;
  if (ROUNDABOUT_TYPES.has(typ) && Number.isFinite(exit) && (exit as number) > 0) {
    const ordinal = t(`navigation.ordinal.${exit}`, { defaultValue: "" });
    const base = ordinal
      ? t("navigation.instructions.roundaboutExit", { ordinal })
      : t("navigation.instructions.roundaboutExitN", { exit });
    const exitRoad =
      next && ROUNDABOUT_EXIT_TYPES.has(next.maneuver.type) ? next.name?.trim() : name;
    const on = exitRoad ? t("navigation.instructions.on", { name: exitRoad }) : "";
    return `${base}${on}`.replace(/\s+/g, " ").trim();
  }
  if (typ === "depart") {
    return name
      ? t("navigation.instructions.departNamed", { name })
      : t("navigation.instructions.depart");
  }
  const key = MANEUVER_KEY[typ] ?? "continue";
  const base = t(`navigation.instructions.${key}`);
  const dir = mod ? " " + t(`navigation.modifier.${mod}`, { defaultValue: "" }) : "";
  const on = name ? t("navigation.instructions.on", { name }) : "";
  return `${base}${dir}${on}`.replace(/\s+/g, " ").trim();
}


export interface OsrmRouteResult {
  coords: [number, number][];
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
  legs: Array<{ distance: number; duration: number }>;
  /** Profile actually used for the returned durations (optional for legacy callers). */
  profile?: RoutingProfile;
}

export async function fetchOsrmRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  signal?: AbortSignal,
  options?: { profile?: RoutingProfile },
): Promise<OsrmRouteResult> {
  return fetchOsrmRouteVia(
    [
      [fromLat, fromLng],
      [toLat, toLng],
    ],
    signal,
    options,
  );
}

async function fetchOsrmRaw(
  osrmProfile: "driving" | "foot",
  path: string,
  signal?: AbortSignal,
): Promise<Response> {
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${path}?overview=full&geometries=geojson&steps=true`;
  console.log(`[OSRM REQUEST] /route/v1/${osrmProfile}/${path.slice(0, 80)}…`);
  return fetch(url, { signal });
}

/** Route through an ordered list of [lat, lng] points (origin, vias…, destination). */
export async function fetchOsrmRouteVia(
  points: [number, number][],
  signal?: AbortSignal,
  options?: { profile?: RoutingProfile },
): Promise<OsrmRouteResult> {
  if (points.length < 2) throw new Error("no-route");
  const path = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const profile = options?.profile ?? getRoutingProfile();
  console.log(
    profile === "foot"
      ? "[FOOT MODE ROUTING] Profile changed to foot"
      : "[FOOT MODE OFF] Profile back to car",
  );

  let res = await fetchOsrmRaw(profile === "foot" ? "foot" : "driving", path, signal);
  let footEstimated = false;
  if (!res.ok && profile === "foot") {
    // The public OSRM demo server only serves the "driving" profile. Fall back
    // to it and scale the duration to walking speed so foot mode still works
    // without surfacing network errors.
    console.log("[FOOT MODE ROUTING] Foot profile unavailable, estimating from car geometry");
    res = await fetchOsrmRaw("driving", path, signal);
    footEstimated = true;
  }
  if (!res.ok) throw new Error("osrm");
  const data = await res.json();
  const r0 = data?.routes?.[0];
  if (!r0) throw new Error("no-route");

  const rawCoords = Array.isArray(r0?.geometry?.coordinates)
    ? r0.geometry.coordinates
    : [];
  const coords: [number, number][] = rawCoords
    .filter(
      (c: unknown): c is [number, number] =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(c[0]) &&
        Number.isFinite(c[1]),
    )
    .map(([lng, lat]: [number, number]) => [lat, lng]);
  if (coords.length < 2) throw new Error("no-route");
  const steps: RouteStep[] = [];
  const rawLegs = Array.isArray(r0?.legs) ? r0.legs : [];
  const legs: Array<{ distance: number; duration: number }> = [];
  for (const leg of rawLegs) {
    const legSteps = Array.isArray(leg?.steps) ? (leg.steps as OsrmStep[]) : [];
    for (let si = 0; si < legSteps.length; si++) {
      const s = legSteps[si];
      if (!s || !s.maneuver) continue;
      const loc =
        Array.isArray(s.maneuver.location) && s.maneuver.location.length >= 2
          ? s.maneuver.location
          : [0, 0];
      const step: RouteStep = {
        instruction: stepInstruction(s, legSteps[si + 1]),
        distanceMeters: Number.isFinite(s.distance) ? s.distance : 0,
        maneuverType: s.maneuver.type ?? "continue",
        location: [loc[1], loc[0]],
      };
      if (Number.isFinite(s.duration)) step.durationSeconds = s.duration;
      if (s.maneuver.modifier) step.modifier = s.maneuver.modifier;
      if (Number.isFinite(s.maneuver.exit)) step.exit = s.maneuver.exit;
      steps.push(step);
    }
    legs.push({
      distance: Number.isFinite(leg?.distance) ? leg.distance : 0,
      duration: Number.isFinite(leg?.duration) ? leg.duration : 0,
    });
  }
  const distanceM = r0.distance ?? 0;
  let durationS = r0.duration ?? 0;
  if (profile === "foot") {
    if (footEstimated) {
      // Walking-speed estimate from the (identical) car geometry.
      durationS = Math.round(distanceM / FOOT_SPEED_MPS);
      for (const leg of legs) {
        leg.duration = Math.round(leg.distance / FOOT_SPEED_MPS);
      }
      for (const step of steps) {
        step.durationSeconds = step.distanceMeters / FOOT_SPEED_MPS;
      }
    }
    console.log(`[DURATION FOOT] ${durationS}s (${Math.round(durationS / 60)} min)`);
  } else {
    console.log(`[DURATION CAR] ${durationS}s (${Math.round(durationS / 60)} min)`);
  }
  console.log(`[DISTANCE] ${Math.round(distanceM)}m`);
  return {
    coords,
    distanceM,
    durationS,
    steps,
    legs,
    profile,
  };
}

export function hazardsAlongRoute(
  hazards: HazardReport[],
  coords: [number, number][],
): string[] {
  return hazards
    .filter(
      (h) =>
        distanceToPolyline(h.latitude, h.longitude, coords) <
        ROUTE_HAZARD_RADIUS_M,
    )
    .map((h) => h.id);
}

export function buildRouteState(
  destination: RouteState["destination"],
  result: OsrmRouteResult,
  hazards: HazardReport[],
  waypoints: RouteState["waypoints"] = [],
): RouteState {
  const route: RouteState = {
    destination,
    waypoints,
    coords: result.coords,
    distanceM: result.distanceM,
    durationS: result.durationS,
    hazardIds: hazardsAlongRoute(hazards, result.coords),
    steps: result.steps,
    legs: result.legs.map((leg) => ({
      distanceM: leg.distance,
      durationS: leg.duration,
    })),
    profile: result.profile,
  };
  if (result.profile === "foot") {
    // Foot-specific copies for the itinerary panel (distance is identical to
    // the car geometry, only the duration differs).
    route.footDurationS = result.durationS;
    route.footDistanceM = result.distanceM;
    console.log(
      `[ROUTE STATE UPDATED] footDuration: ${route.footDurationS}s, footDistance: ${route.footDistanceM}m set`,
    );
  }
  return route;
}
