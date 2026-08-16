import { useEffect, useRef, useState } from "react";
import { haversine } from "@/lib/geo";

/**
 * Reverse-geocodes the current GPS fix to a city name (Nominatim).
 * Only refetches when the rider has moved more than 500 m.
 */
export function useCityName(lat: number | null | undefined, lng: number | null | undefined) {
  const [city, setCity] = useState<string | null>(null);
  const lastFix = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    const prev = lastFix.current;
    if (prev && haversine(prev.lat, prev.lng, lat, lng) < 500) return;
    lastFix.current = { lat, lng };

    let cancelled = false;
    (async () => {
      try {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "json");
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lon", String(lng));
        url.searchParams.set("zoom", "12");
        const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`nominatim ${res.status}`);
        const data = (await res.json()) as {
          address?: Record<string, string | undefined>;
        };
        const a = data.address ?? {};
        const name =
          a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.region ?? null;
        if (cancelled || !name) return;
        setCity(name);
        console.log("🏙️ [CITY DETECTED]", { city: name, lat, lon: lng });
      } catch (error) {
        console.error("❌ [CITY DETECTION ERROR]", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return city;
}
