import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";
import { UserMarker } from "@/components/vigla/UserMarker";
import { ZoomControls } from "@/components/vigla/ZoomControls";
import { HazardMarker } from "@/components/vigla/HazardMarker";



function officialRadarIcon() {
  return L.divIcon({
    className: "vigla-official-radar-icon",
    html: `<div style="width:32px;height:32px;border-radius:8px;background:#3B82F6;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.25),0 0 0 2px #ffffff;color:white;font-size:14px;font-weight:700;">R</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}




function destinationIcon() {
  return L.divIcon({
    className: "vigla-destination-icon",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#0F172A;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.35),0 0 0 3px #ffffff;color:white;font-size:16px;">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function convoyMemberIcon(name: string) {
  const letter = (name.charAt(0) || "?").toUpperCase();
  return L.divIcon({
    className: "vigla-convoy-icon",
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#7C3AED;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.35),0 0 0 3px #ffffff;color:white;font-weight:700;font-size:14px;">${letter}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      map.setView([lat, lng], 15);
      first.current = false;
    } else {
      // Preserve the user's current zoom — never override with a fixed value.
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [lat, lng, map]);
  return null;
}

function NavigationFollow({ lat, lng, heading }: { lat: number; lng: number; heading: number | null }) {
  const map = useMap();
  const firstFollow = useRef(true);
  useEffect(() => {
    if (firstFollow.current) {
      // On nav start, zoom in once for a driving view.
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });
      firstFollow.current = false;
    } else {
      // Then just recenter, respecting whatever zoom the user chose.
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  useEffect(() => {
    const el = map.getContainer();
    const h = heading ?? 0;
    el.style.transition = "transform 400ms ease-out";
    el.style.transform = `rotate(${-h}deg)`;
    return () => {
      el.style.transform = "";
    };
  }, [heading, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    // Handle layout settling after mount (bottom tabs, dvh changes).
    const t = window.setTimeout(invalidate, 200);
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);
  return null;
}


function FitRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map(([la, ln]) => L.latLng(la, ln)));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [coords, map]);
  return null;
}

export function MapView() {
  const position = useVigla((s) => s.position);
  const hazards = useVigla((s) => s.hazards);
  const officialRadars = useVigla((s) => s.officialRadars);
  const route = useVigla((s) => s.route);
  const navigation = useVigla((s) => s.navigation);
  const convoyMembers = useVigla((s) => s.convoyMembers);
  const mapTheme = useVigla((s) => s.preferences.map_theme);
  const autoRecenter = useVigla((s) => s.preferences.auto_recenter);


  const nearbyHazards = useMemo(() => {
    if (!position) return hazards;
    return hazards.filter((h) => haversine(position.lat, position.lng, h.latitude, h.longitude) < 8000);
  }, [hazards, position]);

  const nearbyOfficial = useMemo(() => {
    if (!position) return officialRadars.slice(0, 500);
    return officialRadars.filter((r) => haversine(position.lat, position.lng, r.latitude, r.longitude) < 8000);
  }, [officialRadars, position]);

  const center: [number, number] = position ? [position.lat, position.lng] : [48.8566, 2.3522];
  const navActive = !!navigation && !navigation.arrived;

  return (
    <MapContainer center={center} zoom={15} zoomControl={false} className="h-full w-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />
      <InvalidateOnResize />
      {position && !route && !navActive && <Recenter lat={position.lat} lng={position.lng} />}
      {position && navActive && (
        <NavigationFollow lat={position.lat} lng={position.lng} heading={position.heading} />
      )}
      {position && <UserMarker lat={position.lat} lng={position.lng} heading={position.heading} />}
      <ZoomControls />

      {route && !navActive && (
        <>
          <Polyline positions={route.coords} pathOptions={{ color: "#2563EB", weight: 6, opacity: 0.85 }} />
          <Marker position={[route.destination.lat, route.destination.lng]} icon={destinationIcon()} />
          <FitRoute coords={route.coords} />
        </>
      )}
      {navigation && navActive && route && (
        <>
          {navigation.consumedCoords.length >= 2 && (
            <Polyline
              positions={navigation.consumedCoords}
              pathOptions={{ color: "#94A3B8", weight: 5, opacity: 0.6 }}
            />
          )}
          {navigation.remainingCoords.length >= 2 && (
            <Polyline
              positions={navigation.remainingCoords}
              pathOptions={{ color: "#FF6B35", weight: 7, opacity: 0.95 }}
            />
          )}
          <Marker position={[route.destination.lat, route.destination.lng]} icon={destinationIcon()} />
        </>
      )}

      {nearbyHazards.map((h) => (
        <HazardMarker key={h.id} hazard={h} />
      ))}

      {nearbyOfficial.map((r) => (
        <Marker key={r.id} position={[r.latitude, r.longitude]} icon={officialRadarIcon()} />
      ))}
      {convoyMembers
        .filter((m) => m.last_lat != null && m.last_lng != null)
        .map((m) => (
          <Marker
            key={m.id}
            position={[m.last_lat!, m.last_lng!]}
            icon={convoyMemberIcon(m.display_name)}
          />
        ))}
    </MapContainer>
  );
}
