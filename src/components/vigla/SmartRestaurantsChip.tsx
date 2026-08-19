import { useEffect, useMemo, useRef, useState } from "react";
import type { FastfoodPOI } from "@/types/fastfoods";
import { haversine, formatDistance } from "@/lib/geo";

interface SmartRestaurantsChipProps {
  /** POIs actually visible in the current viewport. */
  pois: FastfoodPOI[];
  isLoading?: boolean;
  /** All auto-retries exhausted — offer a manual retry. */
  isFailing?: boolean;
  onRetry?: () => void;
  /** Selecting a restaurant: auto-zoom to the cluster + direct route. */
  onSelect: (poi: FastfoodPOI) => void;
  /** Current GPS position, used to sort + label the list by distance. */
  userPosition?: { lat: number; lng: number } | null;
}

const MAX_VISIBLE = 25;

/**
 * Restaurants chip that only exists while POIs are present in the viewport.
 * Tapping expands it into the list of restaurant names; picking one routes
 * straight to it.
 */
export function SmartRestaurantsChip({
  pois,
  isLoading = false,
  isFailing = false,
  onRetry,
  onSelect,
  userPosition,
}: SmartRestaurantsChipProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => {
    if (!userPosition) return pois;
    return [...pois].sort(
      (a, b) =>
        haversine(userPosition.lat, userPosition.lng, a.latitude, a.longitude) -
        haversine(userPosition.lat, userPosition.lng, b.latitude, b.longitude),
    );
  }, [pois, userPosition]);
  const count = pois.length;
  const hasData = count > 0;
  const wasVisible = useRef(hasData);

  useEffect(() => {
    console.log("🍔 [CHIP MOUNTED]");
    return () => console.log("🍔 [CHIP UNMOUNTED]");
  }, []);

  useEffect(() => {
    console.log("🍔 [CHIP RENDER STATE]", { count, hasData, isLoading, isFailing });
  }, [count, hasData, isLoading, isFailing]);

  useEffect(() => {
    if (hasData !== wasVisible.current) {
      console.log("🍔 [CHIP VISIBILITY]", { was: wasVisible.current, now: hasData, count });
      wasVisible.current = hasData;
    }
  }, [hasData, count]);

  useEffect(() => {
    if (!hasData) setExpanded(false);
  }, [hasData]);

  useEffect(() => {
    if (hasData) console.log("🍔 [CHIP_RENDERED]", count);
  }, [hasData, count]);

  if (!hasData && !isFailing && !isLoading) return null;

  const visible = sorted.slice(0, MAX_VISIBLE);
  const extra = count - visible.length;

  return (
    <div
      className="pointer-events-auto flex flex-col items-start gap-2"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {!hasData && isLoading && (
        <div className="pointer-events-none flex items-center gap-2 rounded-xl bg-[#FF8C00]/90 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(255,140,0,0.3)]">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Recherche des restaurants…
        </div>
      )}

      {hasData && (
        <div
          className={`pointer-events-auto rounded-xl bg-[#FF8C00] px-5 py-3 text-white shadow-[0_4px_12px_rgba(255,140,0,0.3)] transition ${
            expanded ? "min-w-[260px] max-w-[300px]" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              console.log("🍔 [CHIP TOGGLED]", {
                state: next ? "expanded" : "collapsed",
                restaurantCount: count,
                names: pois.map((p) => p.name),
              });
            }}
            aria-expanded={expanded}
            className="flex w-full items-center gap-2 text-left text-sm font-bold active:scale-[0.98]"
          >
            <span aria-hidden="true">🍔</span>
            <span className="flex-1">{count} FastFoods nearby</span>
            {isLoading && <span className="text-[10px] font-normal opacity-75">…</span>}
          </button>

          {expanded && (
            <ul className="m-0 max-h-[260px] list-none overflow-y-auto overscroll-contain p-0 pt-2 text-sm font-normal">
              {visible.map((poi) => {
                const d = userPosition
                  ? haversine(userPosition.lat, userPosition.lng, poi.latitude, poi.longitude)
                  : null;
                return (
                  <li key={poi.id} className="border-t border-white/30 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => {
                        console.log("🍔 [CHIP RESTAURANT TAPPED]", {
                          name: poi.name,
                          lat: poi.latitude,
                          lon: poi.longitude,
                        });
                        setExpanded(false);
                        onSelect(poi);
                      }}
                      className="flex w-full items-center gap-2 py-1.5 text-left transition hover:opacity-90 active:scale-[0.98]"
                    >
                      <span className="min-w-0 flex-1 truncate">{poi.name}</span>
                      {d != null && (
                        <span className="shrink-0 text-[11px] opacity-80">
                          {formatDistance(d)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {extra > 0 && (
                <li className="border-t border-white/30 py-1.5 text-xs opacity-80">
                  +{extra} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {isFailing && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="pointer-events-auto rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm active:scale-95"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
