import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Filter, X, Camera, Radar, Siren, Construction, TriangleAlert, Turtle, Eye, EyeOff } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { HAZARD_FILTER_KEYS, type HazardFilterKey } from "@/types/vigla";

const ICONS: Record<HazardFilterKey, React.ComponentType<{ className?: string }>> = {
  radar_fixe: Camera,
  radar_mobile: Radar,
  accident: Siren,
  travaux: Construction,
  obstacle: TriangleAlert,
  ralentissement: Turtle,
};

export function HazardFilters() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const filters = useVigla((s) => s.hazardFilters);
  const toggle = useVigla((s) => s.toggleHazardFilter);
  const setAll = useVigla((s) => s.setAllHazardFilters);

  const activeCount = HAZARD_FILTER_KEYS.filter((k) => filters[k]).length;
  const allOn = activeCount === HAZARD_FILTER_KEYS.length;
  const hasFilter = activeCount < HAZARD_FILTER_KEYS.length;

  return (
    <div className="pointer-events-none absolute left-3 top-20 z-[600] flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("filters.button")}
        aria-expanded={open}
        aria-controls="vigla-hazard-filters-panel"
        className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_4px_12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2"
      >
        <Filter className="h-5 w-5" aria-hidden="true" />
        {hasFilter && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#FF6B35] ring-2 ring-white"
          />
        )}
      </button>

      {open && (
        <div
          id="vigla-hazard-filters-panel"
          role="group"
          aria-label={t("filters.groupLabel")}
          className="pointer-events-auto max-w-[calc(100vw-96px)] rounded-2xl bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.15)] ring-1 ring-slate-200"
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {t("filters.title")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mb-2 px-1">
            <button
              type="button"
              onClick={() => setAll(!allOn)}
              aria-pressed={allOn}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
            >
              {allOn ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("filters.hideAll")}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("filters.showAll")}
                </>
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HAZARD_FILTER_KEYS.map((k) => {
              const Icon = ICONS[k];
              return (
                <FilterChip
                  key={k}
                  label={t(`filters.keys.${k}`)}
                  icon={<Icon className="h-3.5 w-3.5" />}
                  active={filters[k]}
                  onClick={() => toggle(k)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-1 ${
        active
          ? "border-[#FF6B35] bg-[#FF6B35] text-white shadow-sm"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span aria-hidden="true" className="flex items-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
