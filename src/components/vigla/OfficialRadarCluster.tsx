import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

type ClusterPoint = { id: string; latitude: number; longitude: number };

/**
 * Imperative marker-cluster layer for official radars.
 *
 * - Uses leaflet.markercluster directly (no react-leaflet wrapper) so we can
 *   diff-update markers by radar id without recreating the whole layer on
 *   every parent render (position ticks, viewport changes).
 * - `disableClusteringAtZoom: 15` → individual pins when the user is zoomed in.
 * - Hazard markers and the user marker stay outside this layer (unclustered).
 */
export function OfficialRadarCluster({
  radars,
  variant = "radar",
  dark = false,
}: {
  radars: ClusterPoint[];
  variant?: "radar" | "signal";
  /** Theme hint only — never gates the layer (signals work in both modes). */
  dark?: boolean;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    const group = (L as unknown as {
      markerClusterGroup: (opts: L.MarkerClusterGroupOptions) => L.MarkerClusterGroup;
    }).markerClusterGroup({
      chunkedLoading: true,
      // Signals are far denser than radars → keep them clustered longer.
      disableClusteringAtZoom: variant === "signal" ? 17 : 15,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: variant === "signal" ? 80 : 60,
    });
    clusterRef.current = group;
    group.addTo(map);
    return () => {
      group.remove();
      clusterRef.current = null;
      markersRef.current.clear();
    };
  }, [map, variant]);

  useEffect(() => {
    const group = clusterRef.current;
    if (!group) return;

    const next = new Set(radars.map((r) => r.id));
    const existing = markersRef.current;

    // Remove markers no longer present.
    const toRemove: L.Marker[] = [];
    for (const [id, marker] of existing) {
      if (!next.has(id)) {
        toRemove.push(marker);
        existing.delete(id);
      }
    }
    if (toRemove.length) group.removeLayers(toRemove);

    // Add new markers.
    const toAdd: L.Marker[] = [];
    const signalRing = dark ? "#242830" : "#ffffff";
    const signalBg = dark ? "#14171b" : "#0F172A";
    const icon =
      variant === "signal"
        ? L.divIcon({
            className: "vigla-traffic-signal-icon",
            html: `<div style="width:24px;height:24px;border-radius:6px;background:${signalBg};display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;padding:2px 0;box-shadow:0 2px 8px rgba(15,23,42,.3),0 0 0 2px ${signalRing};"><span style="width:6px;height:6px;border-radius:50%;background:#EF4444;"></span><span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;"></span><span style="width:6px;height:6px;border-radius:50%;background:#22C55E;"></span></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })
        : L.divIcon({
            className: "vigla-official-radar-icon",
            html: `<div style="width:32px;height:32px;border-radius:8px;background:#3B82F6;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.25),0 0 0 2px #ffffff;color:white;font-size:14px;font-weight:700;">R</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
    // Theme flip: refresh icons of markers already on the map.
    if (variant === "signal") for (const m of existing.values()) m.setIcon(icon);
    for (const r of radars) {
      if (existing.has(r.id)) continue;
      const m = L.marker([r.latitude, r.longitude], { icon, interactive: false });
      existing.set(r.id, m);
      toAdd.push(m);
    }
    if (toAdd.length) group.addLayers(toAdd);
  }, [radars, variant, dark]);

  return null;
}
