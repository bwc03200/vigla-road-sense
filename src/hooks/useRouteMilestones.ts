import { useMemo } from "react";
import { useVigla } from "@/lib/vigla-store";
import { polylineLength } from "@/lib/geo";
import { matchAlongRoute, type RouteMatch } from "@/lib/route-index";
import { hazardLabel } from "@/lib/i18n-helpers";
import { HAZARD_COLORS, HAZARD_EMOJI } from "@/components/vigla/HazardMarker";
import type { HazardType } from "@/types/vigla";

/**
 * Corridor widths. POIs are matched against the route *segments*
 * (perpendicular distance), not its vertices: OSRM vertices can be hundreds
 * of metres apart on straight roads.
 */
const HAZARD_CORRIDOR_M = 90;
const RADAR_CORRIDOR_M = 150;
const SIGNAL_CORRIDOR_M = 45;
const LOOKAHEAD_M = 8000;

export type MilestoneKind = "hazard" | "radar" | "signal";

export interface RouteMilestone {
  id: string;
  kind: MilestoneKind;
  label: string;
  emoji: string;
  color: string;
  distanceM: number;
  /** Enforced speed (km/h) when the milestone is an official radar. */
  speedLimit?: number | null;
  hazardType?: HazardType;
}

/**
 * Upcoming milestones along the active route, computed purely from data
 * already loaded for the map (hazards + filters, official radars, traffic
 * signals). No extra network request.
 */
export function useRouteMilestones(limit = 5) {
  const active = useVigla((s) => Boolean(s.navigation && !s.navigation.arrived));
  const routeCoords = useVigla((s) => s.route?.coords ?? null);
  // Rounded to 10 m: milestones only need to refresh when the distance shown
  // would actually change, not on every sub-metre GPS update.
  const remainingM = useVigla((s) =>
    s.navigation ? Math.round(s.navigation.distanceRemainingM / 10) * 10 : 0,
  );
  const hazards = useVigla((s) => s.hazards);
  const hazardFilters = useVigla((s) => s.hazardFilters);
  const radars = useVigla((s) => s.officialRadars);
  const signals = useVigla((s) => s.trafficSignals);
  const showSignals = useVigla((s) => s.showTrafficSignals);

  return useMemo<RouteMilestone[]>(() => {
    if (!active || !routeCoords || routeCoords.length < 2) return [];
    const traveled = Math.max(0, polylineLength(routeCoords) - remainingM);
    const ahead = <T,>(matches: RouteMatch<T>[]) =>
      matches.filter((m) => m.alongM > traveled && m.alongM - traveled < LOOKAHEAD_M);

    const out: RouteMilestone[] = [];
    // The route ↔ POI matching is cached per route; only this cheap
    // "what is still ahead of me" pass runs as the rider moves.
    for (const m of ahead(matchAlongRoute(routeCoords, hazards, HAZARD_CORRIDOR_M))) {
      const h = m.item;
      if (hazardFilters && hazardFilters[h.type as HazardType] === false) continue;
      out.push({
        id: h.id,
        kind: "hazard",
        label: hazardLabel(h.type),
        emoji: HAZARD_EMOJI[h.type] ?? "⚠️",
        color: HAZARD_COLORS[h.type] ?? "#EF4444",
        distanceM: m.alongM - traveled,
        hazardType: h.type,
      });
    }
    for (const m of ahead(matchAlongRoute(routeCoords, radars, RADAR_CORRIDOR_M))) {
      const r = m.item;
      out.push({
        id: r.id,
        kind: "radar",
        label: r.vitesse_controlee ? `${r.vitesse_controlee} km/h` : "Radar",
        emoji: "📷",
        color: HAZARD_COLORS.radar_fixe,
        distanceM: m.alongM - traveled,
        speedLimit: r.vitesse_controlee,
      });
    }
    if (showSignals) {
      const seen = new Set<string>();
      for (const m of ahead(matchAlongRoute(routeCoords, signals, SIGNAL_CORRIDOR_M))) {
        const sid = `sig-${m.item.latitude.toFixed(5)},${m.item.longitude.toFixed(5)}`;
        if (seen.has(sid)) continue;
        seen.add(sid);
        out.push({
          id: sid,
          kind: "signal",
          label: "Feu",
          emoji: "🚦",
          color: "#0EA5E9",
          distanceM: m.alongM - traveled,
        });
      }
    }

    out.sort((a, b) => a.distanceM - b.distanceM);
    // Hazards/radars must never be crowded out of the list by a dense cluster
    // of traffic signals (urban routes have dozens): keep them first, then
    // fill the remaining slots with signals, and re-sort by distance.
    const priority = out.filter((m) => m.kind !== "signal").slice(0, limit);
    const fill = out
      .filter((m) => m.kind === "signal")
      .slice(0, Math.max(0, limit - priority.length));
    return [...priority, ...fill].sort((a, b) => a.distanceM - b.distanceM);
  }, [active, routeCoords, remainingM, hazards, hazardFilters, radars, signals, showSignals, limit]);
}

/**
 * Enforced speed limit ahead, derived from the nearest official radar on the
 * active route (`official_radars.vitesse_controlee`). This is the only
 * reliable speed-limit data currently available in the app: there is no
 * per-road maxspeed source, so no limit is shown outside radar coverage.
 */
export function useSpeedLimit(): number | null {
  const milestones = useRouteMilestones(8);
  return useMemo(() => {
    const radar = milestones.find((m) => m.kind === "radar" && m.speedLimit);
    return radar?.speedLimit ?? null;
  }, [milestones]);
}
