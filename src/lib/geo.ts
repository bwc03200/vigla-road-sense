// Distance in meters between two lat/lng points (haversine).
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number): string {
  // Guard against NaN/Infinity coming from a partially-initialised navigation
  // state — a "NaNkm" label made the whole banner look broken.
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatSpeed(kmh: number, unit: "kmh" | "mph" = "kmh"): string {
  const v = unit === "mph" ? kmh * 0.621371 : kmh;
  return Math.round(v).toString();
}

export function speedUnitLabel(unit: "kmh" | "mph"): string {
  return unit === "mph" ? "mph" : "km/h";
}


// Minimum distance in meters from a point to a polyline (array of [lat,lng]).
export function distanceToPolyline(
  lat: number,
  lng: number,
  coords: [number, number][],
): number {
  if (coords.length === 0) return Infinity;
  if (coords.length === 1)
    return haversine(lat, lng, coords[0][0], coords[0][1]);

  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = distanceToSegment(
      lat,
      lng,
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1],
    );
    if (d < best) best = d;
  }
  return best;
}

function distanceToSegment(
  plat: number,
  plng: number,
  alat: number,
  alng: number,
  blat: number,
  blng: number,
): number {
  // Approximate using equirectangular projection at midpoint latitude.
  const toRad = (d: number) => (d * Math.PI) / 180;
  const midLat = toRad((alat + blat) / 2);
  const R = 6371000;
  const ax = toRad(alng) * Math.cos(midLat) * R;
  const ay = toRad(alat) * R;
  const bx = toRad(blng) * Math.cos(midLat) * R;
  const by = toRad(blat) * R;
  const px = toRad(plng) * Math.cos(midLat) * R;
  const py = toRad(plat) * R;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Initial bearing (degrees, 0=N, clockwise) from A to B.
export function bearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Cumulative distance (m) from the first vertex to each vertex of a polyline.
 * Cached per coords array identity: a route's geometry is immutable once
 * fetched, and the navigation engine asks for this on every GPS fix, so
 * recomputing thousands of haversines per tick on long routes is wasted work.
 */
const cumulativeCache = new WeakMap<[number, number][], number[]>();
export function cumulativeDistances(coords: [number, number][]): number[] {
  const cached = cumulativeCache.get(coords);
  if (cached && cached.length === coords.length) return cached;
  const cumulative: number[] = coords.length > 0 ? [0] : [];
  for (let i = 0; i < coords.length - 1; i++) {
    cumulative.push(
      cumulative[i] +
        haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]),
    );
  }
  cumulativeCache.set(coords, cumulative);
  return cumulative;
}

// Project a point onto a polyline. Returns the segment index, the interpolated
// [lat,lng] point, distance from point to route (m), and cumulative distance
// along the route up to the projection (m).
// `endIndex` (exclusive, in segments) bounds the search to a window so a route
// that passes close to itself later (hairpins, interchanges, out-and-back)
// cannot make the projection jump ahead.
export function projectOnPolyline(
  lat: number,
  lng: number,
  coords: [number, number][],
  startIndex = 0,
  endIndex?: number,
): {
  segmentIndex: number;
  point: [number, number];
  distanceToRouteM: number;
  distanceAlongM: number;
} {
  if (coords.length === 0) {
    return {
      segmentIndex: 0,
      point: [lat, lng],
      distanceToRouteM: Infinity,
      distanceAlongM: 0,
    };
  }
  if (coords.length === 1) {
    return {
      segmentIndex: 0,
      point: coords[0],
      distanceToRouteM: haversine(lat, lng, coords[0][0], coords[0][1]),
      distanceAlongM: 0,
    };
  }
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const cumulative = cumulativeDistances(coords);
  const from = Math.max(0, Math.min(startIndex, coords.length - 2));
  const to = Math.max(
    from + 1,
    Math.min(endIndex ?? coords.length - 1, coords.length - 1),
  );
  let bestIdx = from;
  let bestDist = Infinity;
  let bestT = 0;
  let bestPoint: [number, number] = coords[from];
  for (let i = from; i < to; i++) {
    const [alat, alng] = coords[i];
    const [blat, blng] = coords[i + 1];
    const midLat = toRad((alat + blat) / 2);
    const ax = toRad(alng) * Math.cos(midLat) * R;
    const ay = toRad(alat) * R;
    const bx = toRad(blng) * Math.cos(midLat) * R;
    const by = toRad(blat) * R;
    const px = toRad(lng) * Math.cos(midLat) * R;
    const py = toRad(lat) * R;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestT = t;
      bestPoint = [alat + (blat - alat) * t, alng + (blng - alng) * t];
    }
  }
  const segLen = cumulative[bestIdx + 1] - cumulative[bestIdx];
  const distanceAlongM = cumulative[bestIdx] + segLen * bestT;
  return {
    segmentIndex: bestIdx,
    point: bestPoint,
    distanceToRouteM: bestDist,
    distanceAlongM,
  };
}


export function polylineLength(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  const cumulative = cumulativeDistances(coords);
  return cumulative[cumulative.length - 1];
}

/**
 * Bearing (degrees) of the route a little ahead of `distanceAlongM`. Looking
 * `lookAheadM` forward instead of using the current segment keeps the value
 * steady through dense vertices and starts turning just before a corner,
 * which is what the heading-up map and the vehicle arrow should follow.
 */
export function routeBearingAt(
  coords: [number, number][],
  distanceAlongM: number,
  lookAheadM = 25,
): number | null {
  if (coords.length < 2) return null;
  const cumulative = cumulativeDistances(coords);
  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return null;
  const pointAt = (d: number): [number, number] => {
    const target = Math.max(0, Math.min(total, d));
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= target) lo = mid;
      else hi = mid;
    }
    const seg = cumulative[hi] - cumulative[lo];
    const t = seg > 0 ? (target - cumulative[lo]) / seg : 0;
    return [
      coords[lo][0] + (coords[hi][0] - coords[lo][0]) * t,
      coords[lo][1] + (coords[hi][1] - coords[lo][1]) * t,
    ];
  };
  // Near the very end there is nothing ahead: look back instead.
  const a = pointAt(Math.min(distanceAlongM, total - lookAheadM));
  const b = pointAt(Math.min(distanceAlongM, total - lookAheadM) + lookAheadM);
  if (a[0] === b[0] && a[1] === b[1]) return null;
  return bearing(a[0], a[1], b[0], b[1]);
}
