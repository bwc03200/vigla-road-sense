import { useEffect } from "react";
import { useVigla } from "@/lib/vigla-store";

export function useGeolocation() {
  const setPosition = useVigla((s) => s.setPosition);
  const setGeoError = useVigla((s) => s.setGeoError);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setGeoError("unsupported");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        setPosition(
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            timestamp: pos.timestamp,
          },
          pos.coords.speed,
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoError("denied");
        else if (err.code === err.POSITION_UNAVAILABLE) setGeoError("unavailable");
        else setGeoError("timeout");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [setPosition, setGeoError]);
}
