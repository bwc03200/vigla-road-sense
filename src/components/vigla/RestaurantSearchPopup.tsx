/**
 * Instant feedback popup shown the moment a restaurant / cluster is tapped.
 * Rendered in < 50ms so the user never waits on a silent screen while the
 * OSRM route is being computed.
 */
export function RestaurantSearchPopup({
  open,
  label = "🔍 Recherche des restaurants...",
}: {
  open: boolean;
  label?: string;
}) {
  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/2 z-[900] flex -translate-y-1/2 justify-center px-6">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-card/95 px-5 py-4 shadow-xl ring-1 ring-border backdrop-blur">
        <span
          aria-hidden="true"
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#FF8C00] border-t-transparent"
        />
        <span
          role="status"
          aria-live="polite"
          className="text-sm font-semibold text-foreground"
        >
          {label}
        </span>
      </div>
    </div>
  );
}
