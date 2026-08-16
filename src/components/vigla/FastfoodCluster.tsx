import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { fastfoodIcon, fastfoodPopupHtml } from "@/components/vigla/FastfoodMarker";
import type { FastfoodPOI } from "@/types/fastfoods";
import { useRouteWaypoint } from "@/hooks/useRouteWaypoint";


/**
 * Clustered fast-food layer (80px radius, count badge from markercluster's
 * default renderer). Markers keep hover/tap popups — no permanent labels.
 */
export function FastfoodCluster({
  pois,
  zoom,
  dark = false,
  onSelect,
}: {
  pois: FastfoodPOI[];
  zoom: number;
  dark?: boolean;
  /** Selecting a POI: auto-zoom to the cluster + direct route. */
  onSelect?: (poi: FastfoodPOI) => void;
}) {
  const map = useMap();
  const { addWaypoint } = useRouteWaypoint();
  const actionRef = useRef<(poi: FastfoodPOI) => void>(() => {});
  actionRef.current = (poi: FastfoodPOI) => {
    if (onSelect) {
      void onSelect(poi);
      return;
    }
    void addWaypoint({
      name: poi.name,
      lat: poi.latitude,
      lng: poi.longitude,
      type: "restaurant",
      brand: poi.brand,
    });
  };
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());


  useEffect(() => {
    const group = (
      L as unknown as {
        markerClusterGroup: (o: L.MarkerClusterGroupOptions) => L.MarkerClusterGroup;
      }
    ).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 80,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
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
    console.log("🍔 [CLUSTER] pois:", pois.length, "zoom:", zoom, "group:", !!group);
    if (!group) return;
    const existing = markersRef.current;
    const next = new Map(pois.map((p) => [p.id, p]));


    const toRemove: L.Marker[] = [];
    for (const [id, marker] of existing) {
      if (!next.has(id)) {
        toRemove.push(marker);
        existing.delete(id);
      }
    }
    if (toRemove.length) group.removeLayers(toRemove);

    const toAdd: L.Marker[] = [];
    for (const poi of pois) {
      const icon = fastfoodIcon(poi, zoom, dark);
      const current = existing.get(poi.id);
      if (current) {
        // Zoom / theme change: refresh icon in place instead of rebuilding.
        current.setIcon(icon);
        continue;
      }
      const m = L.marker([poi.latitude, poi.longitude], { icon });
      m.bindPopup(fastfoodPopupHtml(poi, dark), { closeButton: false, minWidth: 150 });
      m.on("mouseover", () => m.openPopup());
      m.on("popupopen", (e: L.LeafletEvent) => {
        const el = (e as unknown as { popup: L.Popup }).popup.getElement();
        const btn = el?.querySelector<HTMLButtonElement>("[data-fastfood-route]");
        if (!btn) return;
        btn.onclick = (ev) => {
          ev.stopPropagation();
          actionRef.current(poi);
          m.closePopup();
        };
      });
      existing.set(poi.id, m);
      toAdd.push(m);

    }
    if (toAdd.length) group.addLayers(toAdd);
    console.log("🍔 [CLUSTER] added:", toAdd.length, "removed:", toRemove.length, "total:", existing.size);
  }, [pois, zoom, dark]);


  return null;
}
