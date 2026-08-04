import { useMemo } from "react";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";
import { hazardLabel } from "@/lib/i18n-helpers";
import { HAZARD_COLORS, HAZARD_EMOJI } from "@/components/vigla/HazardMarker";
import type { HazardType } from "@/types/vigla";

/**
 * Corridor widths. OSRM geometry vertices can be hundreds of metres apart on
 * straight roads, so matching POIs against *vertices* missed almost everything
 * (that was why the RouteBar always showed its empty "clear" state). We now
 * match against the route *segments* (perpendicular distance).
 */
const HAZARD_CORRIDOR_M = 90;
const RADAR_CORRIDOR_M = 150;
const SIGNAL_CORRIDOR_M = 45;
const LOOKAHEAD_M = 8000;

/** Perpendicular distance (m) from a point to segment AB + along-offset (m). */
function segmentMatch(
  lat: number,
  lng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { dist: number; along: number } {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((aLat * Math.PI) / 180);
  const ax = 0;
  const ay = 0;
  const bx = (bLng - aLng) * mPerDegLng;
  const by = (bLat - aLat) * mPerDegLat;
  const px = (lng - aLng) * mPerDegLng;
  const py = (lat - aLat) * mPerDegLat;
  const len2 = bx * bx + by * by;
  const tRaw = len2 === 0 ? 0 : ((px - ax) * bx + (py - ay) * by) / len2;
  const t = Math.min(1, Math.max(0, tRaw));
  const cx = bx * t;
  const cy = by * t;
  return {
    dist: Math.hypot(px - cx, py - cy),
    along: Math.sqrt(len2) * t,
  };
}


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
  const navigation = useVigla((s) => s.navigation);
  const hazards = useVigla((s) => s.hazards);
  const hazardFilters = useVigla((s) => s.hazardFilters);
  const radars = useVigla((s) => s.officialRadars);
  const signals = useVigla((s) => s.trafficSignals);
  const showSignals = useVigla((s) => s.showTrafficSignals);

  return useMemo<RouteMilestone[]>(() => {
    if (!navigation || navigation.arrived) return [];
    const coords = navigation.remainingCoords;
    if (coords.length < 2) return [];

    const seen = new Set<string>();
    const out: RouteMilestone[] = [];
    let along = 0;

    for (let i = 1; i < coords.length && along < LOOKAHEAD_M; i++) {
      const [pLat, pLng] = coords[i - 1];
      const [la, ln] = coords[i];
      along += haversine(pLat, pLng, la, ln);

      for (const h of hazards) {
        if (seen.has(h.id)) continue;
        if (hazardFilters && hazardFilters[h.type as HazardType] === false) continue;
        if (haversine(la, ln, h.latitude, h.longitude) <= ON_ROUTE_M) {
          seen.add(h.id);
          out.push({
            id: h.id,
            kind: "hazard",
            label: hazardLabel(h.type),
            emoji: HAZARD_EMOJI[h.type] ?? "⚠️",
            color: HAZARD_COLORS[h.type] ?? "#EF4444",
            distanceM: along,
            hazardType: h.type,
          });
        }
      }

      for (const r of radars) {
        if (seen.has(r.id)) continue;
        if (haversine(la, ln, r.latitude, r.longitude) <= ON_ROUTE_M) {
          seen.add(r.id);
          out.push({
            id: r.id,
            kind: "radar",
            label: r.vitesse_controlee ? `${r.vitesse_controlee} km/h` : "Radar",
            emoji: "📷",
            color: HAZARD_COLORS.radar_fixe,
            distanceM: along,
            speedLimit: r.vitesse_controlee,
          });
        }
      }

      if (showSignals) {
        for (const s of signals) {
          const sid = `sig-${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
          if (seen.has(sid)) continue;
          if (haversine(la, ln, s.latitude, s.longitude) <= 35) {
            seen.add(sid);
            out.push({
              id: sid,
              kind: "signal",
              label: "Feu",
              emoji: "🚦",
              color: "#0EA5E9",
              distanceM: along,
            });
          }
        }
      }

      if (out.length >= limit * 3) break;
    }

    out.sort((a, b) => a.distanceM - b.distanceM);
    return out.slice(0, limit);
  }, [navigation, hazards, hazardFilters, radars, signals, showSignals, limit]);
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
