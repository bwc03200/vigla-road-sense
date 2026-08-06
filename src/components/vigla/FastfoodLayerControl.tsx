import { useVigla } from "@/lib/vigla-store";

/**
 * Toggle chip for the fast-food POI layer. Visibility is persisted in
 * localStorage (`vigla:showFastfoods`) through the Vigla store.
 */
export function FastfoodLayerControl({ count = 0 }: { count?: number }) {
  const show = useVigla((s) => s.showFastfoods);
  const toggle = useVigla((s) => s.toggleFastfoods);

  return (
    <button
      type="button"
      onClick={toggle}
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
      {show && count > 0 && (
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#FF6B35]">
          {count}
        </span>
      )}
    </button>
  );
}
