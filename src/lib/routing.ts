import type { HazardReport, RouteState, RouteStep } from "@/types/vigla";
import { distanceToPolyline } from "./geo";
import i18n from "@/i18n/i18n";

const ROUTE_HAZARD_RADIUS_M = 500;

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
}

export async function fetchOsrmRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  signal?: AbortSignal,
): Promise<OsrmRouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
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
  const legs = Array.isArray(r0?.legs) ? r0.legs : [];
  for (const leg of legs) {
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
  }
  return {
    coords,
    distanceM: r0.distance ?? 0,
    durationS: r0.duration ?? 0,
    steps,
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
): RouteState {
  return {
    destination,
    coords: result.coords,
    distanceM: result.distanceM,
    durationS: result.durationS,
    hazardIds: hazardsAlongRoute(hazards, result.coords),
    steps: result.steps,
  };
}
