import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { BRAND_COLORS, BRAND_ICONS, type FastfoodPOI } from "@/types/fastfoods";

/**
 * Brand pastille icon. Variable size by zoom (40px wide view / 36px close-up),
 * thicker ring + brand glow in Moto Mode so it stays readable on dark tiles.
 */
export function fastfoodIcon(
  poi: FastfoodPOI,
  zoom: number,
  isDarkMode: boolean,
): L.DivIcon {
  const size = zoom < 15 ? 40 : 36;
  const ringWidth = isDarkMode ? 2.5 : 2;
  const brandColor = BRAND_COLORS[poi.brand] ?? "#64748B";
  const background = isDarkMode ? "#1F2937" : "#FFFFFF";
  const glow = isDarkMode ? `, 0 0 3px ${brandColor}` : "";
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${background};display:flex;align-items:center;justify-content:center;font-size:${zoom < 15 ? 24 : 21}px;line-height:1;box-shadow:0 2px 8px rgba(15,23,42,.28), 0 0 0 ${ringWidth}px ${brandColor}${glow};">${BRAND_ICONS[poi.brand] ?? "🍴"}</div>`;
  return L.divIcon({
    html,
    className: "fastfood-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Popup markup shared by the React marker and the clustered leaflet markers. */
export function fastfoodPopupHtml(poi: FastfoodPOI, isDarkMode: boolean): string {
  const fg = isDarkMode ? "#F8FAFC" : "#0F172A";
  const sub = isDarkMode ? "#94A3B8" : "#64748B";
  return `<div style="min-width:120px"><div style="font-weight:600;font-size:13px;color:${fg}">${poi.name}</div><div style="font-size:11px;color:${sub}">Fast-food</div></div>`;
}

interface FastfoodMarkerProps {
  poi: FastfoodPOI;
  zoom: number;
  isDarkMode: boolean;
}

export function FastfoodMarker({ poi, zoom, isDarkMode }: FastfoodMarkerProps) {
  const icon = useMemo(
    () => fastfoodIcon(poi, zoom, isDarkMode),
    [poi, zoom, isDarkMode],
  );

  return (
    <Marker position={[poi.latitude, poi.longitude]} icon={icon}>
      <Popup closeButton={false} minWidth={120}>
        <div className="p-0.5">
          <div className="text-[13px] font-semibold text-foreground">{poi.name}</div>
          <div className="text-[11px] text-muted-foreground">Fast-food</div>
        </div>
      </Popup>
    </Marker>
  );
}
