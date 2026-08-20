import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVigla } from "@/lib/vigla-store";
import { haversine } from "@/lib/geo";
import { WaypointRow } from "./WaypointRow";
import { StepRow } from "./StepRow";


function formatDistance(m: number) {
  if (!Number.isFinite(m) || m < 0) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatEta(s: number) {
  if (!Number.isFinite(s) || s < 0) return "—";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function ItineraryPanel() {
  const { t } = useTranslation();
  const position = useVigla((s) => s.position);
  const route = useVigla((s) => s.route);

  const items = useMemo(() => {
    if (!route || route.waypoints.length === 0) return [];
    const waypoints = route.waypoints;
    const legs = route.legs ?? [];
    let cumulativeDistance = 0;
    let cumulativeDuration = 0;
    return waypoints.map((wp, i) => {
      if (i > 0 && legs[i - 1]) {
        cumulativeDistance += legs[i - 1].distanceM;
        cumulativeDuration += legs[i - 1].durationS;
      }
      return {
        waypoint: wp,
        distanceM: cumulativeDistance,
        durationS: cumulativeDuration,
      };
    });
  }, [route]);

  const currentIndex = useMemo(() => {
    if (!position || !route || route.waypoints.length === 0) return -1;
    let minDist = Infinity;
    let idx = -1;
    route.waypoints.forEach((wp, i) => {
      const d = haversine(position.lat, position.lng, wp.lat, wp.lon);
      if (d < minDist) {
        minDist = d;
        idx = i;
      }
    });
    return idx;
  }, [position, route]);

  useEffect(() => {
    if (!route || route.waypoints.length === 0) return;
    console.log(
      "📋 [ITINERARY DISPLAYED] —",
      route.waypoints.length,
      "waypoints, total",
      formatDistance(route.distanceM) + ",",
      formatEta(route.durationS),
    );
  }, [route]);

  if (!route || route.waypoints.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center px-3 pb-3 md:bottom-4 md:justify-end">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-background/95 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">{t("navigation.itinerary")}</div>
          <div className="text-xs text-muted-foreground">
            {route.waypoints.length} {t("navigation.stops")}
          </div>
        </div>
        <div className="max-h-[32vh] space-y-1 overflow-y-auto p-2 scrollbar-thin">
          {items.map((item, i) => (
            <WaypointRow
              key={item.waypoint.id}
              index={i}
              waypoint={item.waypoint}
              distanceM={item.distanceM}
              durationS={item.durationS}
              isCurrent={i === currentIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
