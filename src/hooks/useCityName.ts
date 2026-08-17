import { useEffect, useRef, useState } from "react";
import { haversine } from "@/lib/geo";
import { fetchCityName } from "@/lib/city-name";

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
        const name = await fetchCityName(lat, lng);
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
