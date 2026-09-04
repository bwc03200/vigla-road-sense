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
}
interface OsrmStep {
  distance: number;
  maneuver: OsrmManeuver;
  name?: string;
}

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

function stepInstruction(s: OsrmStep): string {
  const t = i18n.t.bind(i18n);
  const typ = s.maneuver.type;
  const mod = s.maneuver.modifier;
  const name = s.name?.trim();
  if (typ === "arrive") return t("navigation.instructions.arrive");
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
  /** Profile actually used for the returned durations. */
  profile: RoutingProfile;
}

export async function fetchOsrmRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  signal?: AbortSignal,
): Promise<OsrmRouteResult> {
  return fetchOsrmRouteVia(
    [
      [fromLat, fromLng],
      [toLat, toLng],
    ],
    signal,
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
): Promise<OsrmRouteResult> {
  if (points.length < 2) throw new Error("no-route");
  const path = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const profile = getRoutingProfile();
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
    for (const s of legSteps) {
      if (!s || !s.maneuver) continue;
      const loc =
        Array.isArray(s.maneuver.location) && s.maneuver.location.length >= 2
          ? s.maneuver.location
          : [0, 0];
      steps.push({
        instruction: stepInstruction(s),
        distanceMeters: Number.isFinite(s.distance) ? s.distance : 0,
        maneuverType: s.maneuver.type ?? "continue",
        location: [loc[1], loc[0]],
      });
    }
    legs.push({
      distance: Number.isFinite(leg?.distance) ? leg.distance : 0,
      duration: Number.isFinite(leg?.duration) ? leg.duration : 0,
    });
  }
  return {
    coords,
    distanceM: r0.distance ?? 0,
    durationS: r0.duration ?? 0,
    steps,
    legs,
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
  return {
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
  };
}
