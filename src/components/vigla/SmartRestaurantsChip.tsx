import { useEffect, useRef, useState } from "react";
import type { FastfoodPOI } from "@/types/fastfoods";

interface SmartRestaurantsChipProps {
  /** POIs actually visible in the current viewport. */
  pois: FastfoodPOI[];
  isLoading?: boolean;
  /** All auto-retries exhausted — offer a manual retry. */
  isFailing?: boolean;
  onRetry?: () => void;
  /** Selecting a restaurant: auto-zoom to the cluster + direct route. */
  onSelect: (poi: FastfoodPOI) => void;
}

const MAX_VISIBLE = 5;

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
}: SmartRestaurantsChipProps) {
  const [expanded, setExpanded] = useState(false);
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

  if (!hasData && !isFailing) return null;

  const visible = pois.slice(0, MAX_VISIBLE);
  const extra = count - visible.length;

  return (
    <div
      className="flex flex-col items-start gap-2"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
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
            <ul className="m-0 list-none p-0 pt-2 text-sm font-normal">
              {visible.map((poi) => (
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
                    className="w-full truncate py-1.5 text-left transition hover:opacity-90 active:scale-[0.98]"
                  >
                    {poi.name}
                  </button>
                </li>
              ))}
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
