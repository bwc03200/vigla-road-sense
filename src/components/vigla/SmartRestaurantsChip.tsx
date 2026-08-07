import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";

interface SmartRestaurantsChipProps {
  /** POIs actually visible in the current viewport. */
  count: number;
  isLoading?: boolean;
  /** All auto-retries exhausted — offer a manual retry. */
  isFailing?: boolean;
  onRetry?: () => void;
}

/**
 * Restaurants chip that only exists while POIs are present in the viewport.
 * Toggling persists through the Vigla store (`vigla:showFastfoods`).
 */
export function SmartRestaurantsChip({
  count,
  isLoading = false,
  isFailing = false,
  onRetry,
}: SmartRestaurantsChipProps) {
  const show = useVigla((s) => s.showFastfoods);
  const toggle = useVigla((s) => s.toggleFastfoods);

  const hasData = count > 0;
  const wasVisible = useRef(hasData);

  useEffect(() => {
    if (hasData !== wasVisible.current) {
      console.log("🍔 [CHIP VISIBILITY]", { was: wasVisible.current, now: hasData, count });
      wasVisible.current = hasData;
    }
    if (!hasData) console.log("🍔 [CHIP HIDDEN] No POIs in viewport");
  }, [hasData, count]);

  if (!hasData && !isFailing) return null;

  return (
    <div className="pointer-events-none flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => {
          console.log("🍔 [CHIP TOGGLE]", !show);
          toggle();
        }}
        aria-pressed={show}
        title="Toggle restaurants layer"
        className={`pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border px-4 text-xs font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.18)] transition active:scale-95 ${
          show
            ? "border-[#FF6B35] bg-[#FF6B35] text-white"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <span aria-hidden="true">🍔</span>
        <span>Restaurants</span>
        {hasData && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              show ? "bg-white text-[#FF6B35]" : "bg-slate-100 text-slate-500"
            }`}
          >
            {count}
          </span>
        )}
        {isLoading && <span className="text-[10px] font-normal opacity-75">…</span>}
      </button>

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
