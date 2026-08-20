import { Marker } from "react-leaflet";
import L from "leaflet";
import type { GasStation } from "@/types/vigla";

const icon = L.divIcon({
  className: "vigla-gas-station-icon",
  html: `<div style="width:28px;height:28px;border-radius:9999px;background:#16A34A;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.25),0 0 0 2px #ffffff;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/** Fuel POIs (amenity=fuel). Tapping a pin starts a route to the pump. */
export function GasStationMarkers({
  stations,
  onSelect,
}: {
  stations: GasStation[];
  onSelect: (s: GasStation) => void;
}) {
  return (
    <>
      {stations.map((s) => (
        <Marker
          key={s.id}
          position={[s.latitude, s.longitude]}
          icon={icon}
          eventHandlers={{ click: () => onSelect(s) }}
        />
      ))}
    </>
  );
}
