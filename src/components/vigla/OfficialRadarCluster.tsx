import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { OfficialRadar } from "@/types/vigla";

/**
 * Imperative marker-cluster layer for official radars.
 *
 * - Uses leaflet.markercluster directly (no react-leaflet wrapper) so we can
 *   diff-update markers by radar id without recreating the whole layer on
 *   every parent render (position ticks, viewport changes).
 * - `disableClusteringAtZoom: 15` → individual pins when the user is zoomed in.
 * - Hazard markers and the user marker stay outside this layer (unclustered).
 */
export function OfficialRadarCluster({ radars }: { radars: OfficialRadar[] }) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    const group = (L as unknown as {
      markerClusterGroup: (opts: L.MarkerClusterGroupOptions) => L.MarkerClusterGroup;
    }).markerClusterGroup({
      chunkedLoading: true,
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
    });
    clusterRef.current = group;
    group.addTo(map);
    return () => {
      group.remove();
      clusterRef.current = null;
      markersRef.current.clear();
    };
  }, [map]);

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
    const icon = L.divIcon({
      className: "vigla-official-radar-icon",
      html: `<div style="width:32px;height:32px;border-radius:8px;background:#3B82F6;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.25),0 0 0 2px #ffffff;color:white;font-size:14px;font-weight:700;">R</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    for (const r of radars) {
      if (existing.has(r.id)) continue;
      const m = L.marker([r.latitude, r.longitude], { icon, interactive: false });
      existing.set(r.id, m);
      toAdd.push(m);
    }
    if (toAdd.length) group.addLayers(toAdd);
  }, [radars]);

  return null;
}
