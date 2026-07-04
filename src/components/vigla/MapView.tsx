import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
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
  ralentissement: "#22D3EE",
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
      box-shadow:0 4px 12px rgba(0,0,0,.5),0 0 0 3px rgba(255,255,255,.15);
      font-size:18px;">${HAZARD_EMOJI[type]}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
        border-bottom:28px solid #22D3EE;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

export function MapView() {
  const position = useVigla((s) => s.position);
  const hazards = useVigla((s) => s.hazards);

  const nearbyHazards = useMemo(() => {
    if (!position) return [];
    return hazards.filter(
      (h) =>
        haversine(position.lat, position.lng, h.latitude, h.longitude) < 5000,
    );
  }, [hazards, position]);

  const center: [number, number] = position
    ? [position.lat, position.lng]
    : [48.8566, 2.3522]; // Paris fallback

  return (
    <MapContainer
      center={center}
      zoom={15}
      zoomControl={false}
      className="h-full w-full"
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />
      {position && (
        <>
          <Recenter lat={position.lat} lng={position.lng} />
          <Marker
            position={[position.lat, position.lng]}
            icon={userIcon(position.heading)}
          />
          <Circle
            center={[position.lat, position.lng]}
            radius={30}
            pathOptions={{
              color: "#22D3EE",
              fillColor: "#22D3EE",
              fillOpacity: 0.15,
              weight: 1,
            }}
          />
        </>
      )}
      {nearbyHazards.map((h) => (
        <Marker
          key={h.id}
          position={[h.latitude, h.longitude]}
          icon={hazardIcon(h.type)}
        />
      ))}
    </MapContainer>
  );
}
