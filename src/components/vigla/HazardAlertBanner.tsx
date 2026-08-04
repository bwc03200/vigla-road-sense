import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { formatDistance } from "@/lib/geo";
import { useRouteMilestones } from "@/hooks/useRouteMilestones";

const ALERT_RANGE_M = 300;

/**
 * Full-width red banner shown when a reported hazard sits within ~300m ahead
 * on the active route. Rendered below the main turn widget/speed HUD so it
 * never covers them; disappears on its own once the hazard is passed.
 */
export function HazardAlertBanner({ moto = false }: { moto?: boolean }) {
  const { t } = useTranslation();
  const navigation = useVigla((s) => s.navigation);
  const milestones = useRouteMilestones(5);

  if (!navigation || navigation.arrived) return null;
  const next = milestones.find(
    (m) => m.kind === "hazard" && m.distanceM <= ALERT_RANGE_M,
  );
  if (!next) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-[690] px-3 ${
        moto ? "top-[168px]" : "top-[176px]"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-[#e2313f] px-4 py-2.5 text-white shadow-[0_10px_28px_rgba(226,49,63,0.35)]">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span className="truncate text-sm font-bold">{next.label}</span>
        <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">
          {t("map.in", { distance: formatDistance(next.distanceM) })}
        </span>
      </div>
    </div>
  );
}
