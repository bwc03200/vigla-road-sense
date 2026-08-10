import { useTranslation } from "react-i18next";
import { useVigla } from "@/lib/vigla-store";
import { formatDistance } from "@/lib/geo";
import { useRouteMilestones } from "@/hooks/useRouteMilestones";

/**
 * Compact vertical milestone bar shown on the right side during active
 * navigation, in both standard and Moto mode (theme via `moto`).
 * Data-only consumer: reuses hazards/radars/signals already in the store.
 */
export function RouteBar({ moto = false }: { moto?: boolean }) {
  const { t } = useTranslation();
  const navigation = useVigla((s) => s.navigation);
  const route = useVigla((s) => s.route);
  const milestones = useRouteMilestones(5);

  if (!navigation || navigation.arrived) return null;

  const total = route?.distanceM ?? 0;
  const progress =
    total > 0
      ? Math.min(1, Math.max(0, (total - navigation.distanceRemainingM) / total))
      : 0;
  const minutes = Math.max(0, Math.round(navigation.durationRemainingS / 60));

  const panel = moto
    ? {
        background: "var(--moto-panel, #14171b)",
        border: "1px solid var(--moto-line, #242830)",
        color: "var(--moto-text, #eef1f4)",
      }
    : {
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        color: "#0f172a",
      };
  const dim = moto ? "var(--moto-text-dim, #8b9299)" : "#64748b";
  const track = moto ? "var(--moto-line, #242830)" : "#e2e8f0";

  return (
    <div className="pointer-events-none absolute right-3 top-1/2 z-40 -translate-y-1/2">
      <div
        className="pointer-events-auto flex max-h-[calc(100vh-200px)] w-[58px] flex-col items-center gap-2 overflow-y-auto rounded-2xl px-2 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.18)]"
        style={panel}
      >
        <div className="relative flex w-full flex-col items-center gap-2">
          <div
            className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full"
            style={{ background: track }}
          />
          <div
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full transition-[top] duration-500"
            style={{
              top: `${progress * 100}%`,
              background: moto ? "var(--moto-orange, #ff6a1a)" : "#FF6B35",
              boxShadow: "0 0 0 3px rgba(255,107,53,0.25)",
            }}
          />
          {milestones.length === 0 ? (
            <div
              className="relative py-2 text-center text-[10px] leading-tight"
              style={{ color: dim }}
            >
              {t("map.clear")}
            </div>
          ) : (
            milestones.map((m) => (
              <div key={m.id} className="relative flex flex-col items-center">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[15px]"
                  style={{ background: m.color, boxShadow: "0 0 0 2px rgba(255,255,255,0.9)" }}
                  title={m.label}
                  aria-label={m.label}
                >
                  <span aria-hidden="true">{m.emoji}</span>
                </div>
                <span className="mt-0.5 text-[9px] tabular-nums" style={{ color: dim }}>
                  {formatDistance(m.distanceM)}
                </span>
              </div>
            ))
          )}
        </div>
        <div
          className="mt-1 w-full border-t pt-1.5 text-center text-[13px] font-bold tabular-nums"
          style={{ borderColor: track }}
        >
          {minutes}&apos;
        </div>
      </div>
    </div>
  );
}
