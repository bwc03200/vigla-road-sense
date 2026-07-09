import { fetchOsrmRoute, type OsrmRouteResult } from "@/lib/routing";

// 8-point compass (bearing degrees from North, clockwise).
export const COMPASS = [
  { id: "N", label: "Nord", bearing: 0 },
  { id: "NE", label: "Nord-Est", bearing: 45 },
  { id: "E", label: "Est", bearing: 90 },
  { id: "SE", label: "Sud-Est", bearing: 135 },
  { id: "S", label: "Sud", bearing: 180 },
  { id: "SW", label: "Sud-Ouest", bearing: 225 },
  { id: "W", label: "Ouest", bearing: 270 },
  { id: "NW", label: "Nord-Ouest", bearing: 315 },
] as const;

export type Compass = (typeof COMPASS)[number]["id"] | "ALL";

// Offset lat/lng by a distance (m) and bearing (deg).
function offset(
  lat: number,
  lng: number,
  distanceM: number,
  bearingDeg: number,
): [number, number] {
  const R = 6371000;
  const brng = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const dR = distanceM / R;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(dR) + Math.cos(φ1) * Math.sin(dR) * Math.cos(brng),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dR) * Math.cos(φ1),
      Math.cos(dR) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
}

/**
 * Build a rough loop of ~distanceKm from origin in a chosen direction.
 * We drop 2 waypoints spaced around the target bearing and let OSRM stitch
 * a route back to the origin. Retries once with a different seed on failure.
 */
export async function generateQuickRide(
  originLat: number,
  originLng: number,
  distanceKm: number,
  direction: Compass,
): Promise<OsrmRouteResult> {
  const attempts: Array<{ seed: number }> = [{ seed: 1 }, { seed: 2 }];
  let lastErr: unknown = null;
  for (const { seed } of attempts) {
    try {
      // Two waypoints roughly at distance/4 along the direction, spread ±30°.
      const legM = (distanceKm * 1000) / 4;
      const baseBearing =
        direction === "ALL"
          ? Math.floor((Math.random() + seed * 0.13) * 360) % 360
          : COMPASS.find((c) => c.id === direction)!.bearing;
      const spread = 40;
      const b1 = baseBearing - spread + seed * 5;
      const b2 = baseBearing + spread - seed * 3;
      const [w1lat, w1lng] = offset(originLat, originLng, legM, b1);
      const [w2lat, w2lng] = offset(w1lat, w1lng, legM, baseBearing);
      // Return leg via a bearing offset from the perpendicular.
      const [w3lat, w3lng] = offset(w2lat, w2lng, legM, b2 + 180);

      // OSRM supports multi-waypoints only via multiple ; separated coords.
      const coords = [
        `${originLng},${originLat}`,
        `${w1lng},${w1lat}`,
        `${w2lng},${w2lat}`,
        `${w3lng},${w3lat}`,
        `${originLng},${originLat}`,
      ].join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("osrm");
      const data = await res.json();
      const r0 = data?.routes?.[0];
      if (!r0) throw new Error("no-route");
      const raw = Array.isArray(r0?.geometry?.coordinates) ? r0.geometry.coordinates : [];
      const routeCoords: [number, number][] = raw
        .filter(
          (c: unknown): c is [number, number] =>
            Array.isArray(c) &&
            c.length >= 2 &&
            Number.isFinite(c[0]) &&
            Number.isFinite(c[1]),
        )
        .map(([lng, lat]: [number, number]) => [lat, lng]);
      if (routeCoords.length < 2) throw new Error("no-route");
      return {
        coords: routeCoords,
        distanceM: r0.distance ?? 0,
        durationS: r0.duration ?? 0,
        steps: [],
      };
    } catch (err) {
      lastErr = err;
    }
  }
  // Fallback: simple round-trip to a single point in the direction.
  const b =
    direction === "ALL"
      ? Math.floor(Math.random() * 360)
      : COMPASS.find((c) => c.id === direction)!.bearing;
  const [dLat, dLng] = offset(originLat, originLng, (distanceKm * 1000) / 2, b);
  try {
    return await fetchOsrmRoute(originLat, originLng, dLat, dLng);
  } catch {
    throw lastErr instanceof Error ? lastErr : new Error("no-route");
  }
}
