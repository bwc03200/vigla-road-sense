import type { HazardReport, RouteState, RouteStep } from "@/types/vigla";
import { distanceToPolyline } from "./geo";

const ROUTE_HAZARD_RADIUS_M = 500;

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

const MANEUVER_FR: Record<string, string> = {
  turn: "Tournez",
  "new name": "Continuez",
  depart: "Départ",
  arrive: "Arrivée",
  merge: "Rejoignez",
  "on ramp": "Prenez la bretelle",
  "off ramp": "Sortez",
  fork: "À l'embranchement",
  "end of road": "En bout de rue",
  continue: "Continuez",
  roundabout: "Prenez le rond-point",
  rotary: "Prenez le rond-point",
  "roundabout turn": "Au rond-point, tournez",
  notification: "Continuez",
  "exit roundabout": "Sortez du rond-point",
  "exit rotary": "Sortez du rond-point",
};

const MODIFIER_FR: Record<string, string> = {
  left: "à gauche",
  right: "à droite",
  "sharp left": "franchement à gauche",
  "sharp right": "franchement à droite",
  "slight left": "légèrement à gauche",
  "slight right": "légèrement à droite",
  straight: "tout droit",
  uturn: "faites demi-tour",
};

function stepInstruction(s: OsrmStep): string {
  const t = s.maneuver.type;
  const m = s.maneuver.modifier;
  const name = s.name?.trim();
  const base = MANEUVER_FR[t] ?? "Continuez";
  if (t === "arrive") return "Vous êtes arrivé";
  if (t === "depart") return name ? `Départ sur ${name}` : "Départ";
  const dir = m ? ` ${MODIFIER_FR[m] ?? ""}`.trimEnd() : "";
  const on = name ? ` sur ${name}` : "";
  return `${base}${dir}${on}`.trim();
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
  const coords: [number, number][] = r0.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng],
  );
  const steps: RouteStep[] = [];
  for (const leg of r0.legs ?? []) {
    for (const s of (leg.steps ?? []) as OsrmStep[]) {
      const loc = s.maneuver.location ?? [0, 0];
      steps.push({
        instruction: stepInstruction(s),
        distanceMeters: s.distance ?? 0,
        maneuverType: s.maneuver.type,
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
