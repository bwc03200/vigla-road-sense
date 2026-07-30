import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVigla } from "@/lib/vigla-store";

export type TripSummaryData = {
  distanceKm: number;
  durationSeconds: number;
  avgSpeed: number;
  hazardsCount: number;
};

export function TripSummaryScreen({
  summary,
  onClose,
}: {
  summary: TripSummaryData;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const motoMode = useVigla((s) => s.preferences.moto_mode);
  const speedUnit = useVigla((s) => s.preferences.speed_unit);

  const mins = Math.round(summary.durationSeconds / 60);
  const duration =
    mins < 60 ? `${mins} ${t("common.min")}` : `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}`;
  const isMph = speedUnit === "mph";
  const factor = isMph ? 0.621371 : 1;

  const panel = motoMode
    ? { background: "var(--moto-panel, #14171b)", border: "1px solid var(--moto-line, #242830)", color: "var(--moto-text, #eef1f4)" }
    : undefined;

  return (
    <div
      className="absolute inset-0 z-[900] flex items-center justify-center p-6 backdrop-blur"
      style={motoMode ? { background: "rgba(11,13,16,0.94)" } : { background: "rgba(255,255,255,0.95)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl"
        style={panel}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={
            motoMode
              ? { background: "var(--moto-orange, #ff6a1a)", color: "#fff" }
              : undefined
          }
        >
          <Flag className={motoMode ? "h-7 w-7" : "h-7 w-7 text-primary"} />
        </div>
        <h2
          className="text-xl font-bold text-slate-900"
          style={motoMode ? { color: "var(--moto-text, #eef1f4)" } : undefined}
        >
          {t("navigation.tripSummaryTitle")}
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <Stat
            moto={motoMode}
            label={t("navigation.distance")}
            value={`${(summary.distanceKm * factor).toFixed(1)} ${isMph ? "mi" : "km"}`}
          />
          <Stat moto={motoMode} label={t("navigation.duration")} value={duration} />
          <Stat
            moto={motoMode}
            label={t("navigation.avgSpeed")}
            value={`${Math.round(summary.avgSpeed * factor)} ${isMph ? "mph" : "km/h"}`}
          />
          <Stat
            moto={motoMode}
            label={t("navigation.hazardsCrossed")}
            value={String(summary.hazardsCount)}
          />
        </div>

        <Button
          className="mt-6 h-12 w-full"
          onClick={onClose}
          style={motoMode ? { background: "var(--moto-orange, #ff6a1a)", color: "#fff" } : undefined}
        >
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, moto }: { label: string; value: string; moto: boolean }) {
  return (
    <div>
      <div
        className="text-[11px] uppercase tracking-widest text-slate-500"
        style={moto ? { color: "var(--moto-text-dim, #8b9299)" } : undefined}
      >
        {label}
      </div>
      <div
        className="mt-1 text-lg font-semibold text-slate-900"
        style={moto ? { color: "var(--moto-text, #eef1f4)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
