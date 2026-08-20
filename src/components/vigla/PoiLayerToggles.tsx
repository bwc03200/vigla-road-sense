import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Utensils, TrafficCone, Radar, AlertTriangle } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";

/**
 * Centralized POI display control: one floating map button opening a small
 * panel of switches for every POI layer. State lives in the Zustand store and
 * is persisted to localStorage.
 */
export function PoiLayerToggles({ dark = false }: { dark?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const showFastfoods = useVigla((s) => s.showFastfoods);
  const showSignals = useVigla((s) => s.showTrafficSignals);
  const showRadars = useVigla((s) => s.showOfficialRadars);
  const showHazards = useVigla((s) => s.showHazards);
  const toggleFastfoods = useVigla((s) => s.toggleFastfoods);
  const toggleSignals = useVigla((s) => s.toggleTrafficSignals);
  const toggleRadars = useVigla((s) => s.toggleOfficialRadars);
  const toggleHazards = useVigla((s) => s.toggleHazards);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const activeCount = [showFastfoods, showSignals, showRadars, showHazards].filter(Boolean).length;

  const rows = [
    { key: "fastfoods", icon: Utensils, label: t("layers.fastfoods"), value: showFastfoods, onToggle: toggleFastfoods },
    { key: "signals", icon: TrafficCone, label: t("layers.signals"), value: showSignals, onToggle: toggleSignals },
    { key: "radars", icon: Radar, label: t("layers.radars"), value: showRadars, onToggle: toggleRadars },
    { key: "hazards", icon: AlertTriangle, label: t("layers.hazards"), value: showHazards, onToggle: toggleHazards },
  ];

  const panelBg = dark ? "bg-[#14171b] text-slate-100 ring-[#2a2f36]" : "bg-white text-slate-900 ring-slate-200";

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        aria-label={t("layers.title")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-11 items-center justify-center rounded-full shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 transition active:scale-95 ${panelBg}`}
      >
        <Layers className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF6B35] px-1 text-[10px] font-bold text-white">
          {activeCount}
        </span>
      </button>

      {open && (
        <div
          className={`absolute right-0 top-13 mt-2 w-60 overflow-hidden rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.22)] ring-1 ${panelBg}`}
        >
          <div className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {t("layers.title")}
          </div>
          {rows.map(({ key, icon: Icon, label, value, onToggle }) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={value}
              onClick={onToggle}
              className={`flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium transition ${
                dark ? "hover:bg-white/5" : "hover:bg-slate-50"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${value ? "text-[#FF6B35]" : dark ? "text-slate-500" : "text-slate-400"}`} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  value ? "bg-[#FF6B35]" : dark ? "bg-slate-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-5" : "left-0.5"}`}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
