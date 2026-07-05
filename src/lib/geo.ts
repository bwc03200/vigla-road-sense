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
