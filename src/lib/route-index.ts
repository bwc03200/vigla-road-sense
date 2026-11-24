import { cumulativeDistances } from "@/lib/geo";

/**
 * Matches points of interest (radars, hazards, traffic signals) against a
 * route ONCE per route instead of on every GPS fix.
 *
 * The naive version walked every route segment against every POI on each
 * navigation tick — with ~3 000 official radars that is over a million
 * distance computations per second on a phone, repeated by each component
 * that needs the list. Here the route segments are bucketed in a coarse grid,
 * each POI only tests the segments in its own cell, and the result (distance
 * along the route for every matched POI) is cached for as long as the route
 * geometry and the POI list stay the same objects.
 */

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteMatch<T> {
  item: T;
  /** Distance from the start of the route to the point abeam the POI (m). */
  alongM: number;
  /** Perpendicular distance from the POI to the route (m). */
  offsetM: number;
}

/** Grid cell size in degrees (~1.1 km north-south). */
const CELL_DEG = 0.01;
/** Widest corridor any caller may ask for; segments are bucketed with this margin. */
const MAX_CORRIDOR_M = 600;
const M_PER_DEG_LAT = 111_320;

type Grid = Map<string, number[]>;

const gridCache = new WeakMap<[number, number][], Grid>();
const matchCache = new WeakMap<
  [number, number][],
  WeakMap<readonly RoutePoint[], Map<number, RouteMatch<RoutePoint>[]>>
>();

function cellKey(latCell: number, lngCell: number): string {
  return `${latCell}:${lngCell}`;
}

function buildGrid(coords: [number, number][]): Grid {
  const grid: Grid = new Map();
  for (let i = 0; i < coords.length - 1; i++) {
    const [aLat, aLng] = coords[i];
    const [bLat, bLng] = coords[i + 1];
    const padLat = MAX_CORRIDOR_M / M_PER_DEG_LAT;
    const padLng =
      MAX_CORRIDOR_M / (M_PER_DEG_LAT * Math.max(0.2, Math.cos((aLat * Math.PI) / 180)));
    const latFrom = Math.floor((Math.min(aLat, bLat) - padLat) / CELL_DEG);
    const latTo = Math.floor((Math.max(aLat, bLat) + padLat) / CELL_DEG);
    const lngFrom = Math.floor((Math.min(aLng, bLng) - padLng) / CELL_DEG);
    const lngTo = Math.floor((Math.max(aLng, bLng) + padLng) / CELL_DEG);
    for (let la = latFrom; la <= latTo; la++) {
      for (let ln = lngFrom; ln <= lngTo; ln++) {
        const key = cellKey(la, ln);
        const bucket = grid.get(key);
        if (bucket) bucket.push(i);
        else grid.set(key, [i]);
      }
    }
  }
  return grid;
}

/** Perpendicular distance (m) from a point to segment AB and offset along it (m). */
function segmentMatch(
  lat: number,
  lng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { dist: number; along: number } {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((aLat * Math.PI) / 180);
  const bx = (bLng - aLng) * mPerDegLng;
  const by = (bLat - aLat) * M_PER_DEG_LAT;
  const px = (lng - aLng) * mPerDegLng;
  const py = (lat - aLat) * M_PER_DEG_LAT;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / len2));
  return {
    dist: Math.hypot(px - bx * t, py - by * t),
    along: Math.sqrt(len2) * t,
  };
}

/**
 * POIs lying within `corridorM` of the route, sorted by distance along it.
 * A POI matched by several segments (the route passing it twice) is reported
 * at its closest approach.
 */
export function matchAlongRoute<T extends RoutePoint>(
  coords: [number, number][],
  items: readonly T[],
  corridorM: number,
): RouteMatch<T>[] {
  if (coords.length < 2 || items.length === 0) return [];
  const corridor = Math.min(corridorM, MAX_CORRIDOR_M);

  let perItems = matchCache.get(coords);
  if (!perItems) {
    perItems = new WeakMap();
    matchCache.set(coords, perItems);
  }
  let perCorridor = perItems.get(items);
  if (!perCorridor) {
    perCorridor = new Map();
    perItems.set(items, perCorridor);
  }
  const cached = perCorridor.get(corridor);
  if (cached) return cached as RouteMatch<T>[];

  let grid = gridCache.get(coords);
  if (!grid) {
    grid = buildGrid(coords);
    gridCache.set(coords, grid);
  }
  const cumulative = cumulativeDistances(coords);

  const out: RouteMatch<T>[] = [];
  for (const item of items) {
    const bucket = grid.get(
      cellKey(Math.floor(item.latitude / CELL_DEG), Math.floor(item.longitude / CELL_DEG)),
    );
    if (!bucket) continue;
    let best: { dist: number; alongM: number } | null = null;
    for (const i of bucket) {
      const m = segmentMatch(
        item.latitude,
        item.longitude,
        coords[i][0],
        coords[i][1],
        coords[i + 1][0],
        coords[i + 1][1],
      );
      if (m.dist <= corridor && (!best || m.dist < best.dist)) {
        best = { dist: m.dist, alongM: cumulative[i] + m.along };
      }
    }
    if (best) out.push({ item, alongM: best.alongM, offsetM: best.dist });
  }
  out.sort((a, b) => a.alongM - b.alongM);
  perCorridor.set(corridor, out as RouteMatch<RoutePoint>[]);
  return out;
}
