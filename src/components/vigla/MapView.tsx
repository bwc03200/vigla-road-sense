import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";
import type { HazardType } from "@/types/vigla";

const HAZARD_COLORS: Record<HazardType, string> = {
  radar_fixe: "#FF6B35",
  radar_mobile: "#F97316",
  accident: "#EF4444",
  travaux: "#F59E0B",
  obstacle: "#EAB308",
  ralentissement: "#0EA5E9",
};

const HAZARD_EMOJI: Record<HazardType, string> = {
  radar_fixe: "📷",
  radar_mobile: "🚔",
  accident: "💥",
  travaux: "🚧",
  obstacle: "⚠️",
  ralentissement: "🐌",
};

function hazardIcon(type: HazardType) {
  const color = HAZARD_COLORS[type];
  return L.divIcon({
    className: "vigla-hazard-icon",
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${color};display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(15,23,42,.25),0 0 0 3px #ffffff;
      font-size:18px;">${HAZARD_EMOJI[type]}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function officialRadarIcon() {
  return L.divIcon({
    className: "vigla-official-radar-icon",
    html: `<div style="
      width:32px;height:32px;border-radius:8px;
      background:#3B82F6;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(15,23,42,.25),0 0 0 2px #ffffff;
      color:white;font-size:14px;font-weight:700;">R</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function userIcon(heading: number | null) {
  const rot = heading ?? 0;
  return L.divIcon({
    className: "vigla-user-icon",
    html: `<div style="transform:rotate(${rot}deg);width:28px;height:28px;">
      <div style="
        width:0;height:0;
        border-left:14px solid transparent;
        border-right:14px solid transparent;
        border-bottom:28px solid #2563EB;
        filter:drop-shadow(0 2px 4px rgba(15,23,42,.35));"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function destinationIcon() {
  return L.divIcon({
    className: "vigla-destination-icon",
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:#0F172A;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(15,23,42,.35),0 0 0 3px #ffffff;
      color:white;font-size:16px;">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
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
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [lat, lng, map]);
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

  const nearbyHazards = useMemo(() => {
    if (!position) return hazards;
    return hazards.filter(
      (h) =>
        haversine(position.lat, position.lng, h.latitude, h.longitude) < 8000,
    );
  }, [hazards, position]);

  const nearbyOfficial = useMemo(() => {
    if (!position) return officialRadars.slice(0, 500);
    return officialRadars.filter(
      (r) =>
        haversine(position.lat, position.lng, r.latitude, r.longitude) < 8000,
    );
  }, [officialRadars, position]);

  const center: [number, number] = position
    ? [position.lat, position.lng]
    : [48.8566, 2.3522];

  return (
    <MapContainer
      center={center}
      zoom={15}
      zoomControl={false}
      className="h-full w-full"
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />
      {position && !route && <Recenter lat={position.lat} lng={position.lng} />}
      {position && (
        <>
          <Marker
            position={[position.lat, position.lng]}
            icon={userIcon(position.heading)}
          />
          <Circle
            center={[position.lat, position.lng]}
            radius={30}
            pathOptions={{
              color: "#2563EB",
              fillColor: "#2563EB",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
        </>
      )}
      {route && (
        <>
          <Polyline
            positions={route.coords}
            pathOptions={{ color: "#2563EB", weight: 6, opacity: 0.85 }}
          />
          <Marker
            position={[route.destination.lat, route.destination.lng]}
            icon={destinationIcon()}
          />
          <FitRoute coords={route.coords} />
        </>
      )}
      {nearbyHazards.map((h) => (
        <Marker
          key={h.id}
          position={[h.latitude, h.longitude]}
          icon={hazardIcon(h.type)}
        />
      ))}
      {nearbyOfficial.map((r) => (
        <Marker
          key={r.id}
          position={[r.latitude, r.longitude]}
          icon={officialRadarIcon()}
        />
      ))}
    </MapContainer>
  );
}
