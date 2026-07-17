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
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

export function formatSpeed(kmh: number): string {
  return Math.round(kmh).toString();
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

// Project a point onto a polyline. Returns the segment index, the interpolated
// [lat,lng] point, distance from point to route (m), and cumulative distance
// along the route up to the projection (m).
export function projectOnPolyline(
  lat: number,
  lng: number,
  coords: [number, number][],
  startIndex = 0,
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
  // Precompute cumulative distances along the whole polyline so results are
  // consistent regardless of startIndex.
  const cumulative: number[] = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    const segLen = haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    cumulative.push(cumulative[i] + segLen);
  }
  const from = Math.max(0, Math.min(startIndex, coords.length - 2));
  let bestIdx = from;
  let bestDist = Infinity;
  let bestT = 0;
  let bestPoint: [number, number] = coords[from];
  for (let i = from; i < coords.length - 1; i++) {
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
  const segLen = haversine(
    coords[bestIdx][0],
    coords[bestIdx][1],
    coords[bestIdx + 1][0],
    coords[bestIdx + 1][1],
  );
  const distanceAlongM = cumulative[bestIdx] + segLen * bestT;
  return {
    segmentIndex: bestIdx,
    point: bestPoint,
    distanceToRouteM: bestDist,
    distanceAlongM,
  };
}


export function polylineLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return total;
}

