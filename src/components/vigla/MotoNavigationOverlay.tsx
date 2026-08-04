import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowUp, Radar, Signal, SignalLow, SignalMedium, Wifi } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";
import { formatDistance, formatSpeed } from "@/lib/geo";
import { TrafficSignalAhead } from "@/components/vigla/TrafficSignalAhead";
import { RouteBar } from "@/components/vigla/RouteBar";
import { HazardAlertBanner } from "@/components/vigla/HazardAlertBanner";
import { useSpeedLimit } from "@/hooks/useRouteMilestones";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Moto Mode variant of the active navigation HUD.
 * Rendered only when preferences.moto_mode is on AND navigation is active.
 * Standard NavigationOverlay hides its visuals in that case; the navigation
 * engine hook still runs there so business logic is untouched.
 */
export function MotoNavigationOverlay({ onReport }: { onReport?: () => void }) {
  const { t } = useTranslation();
  const navigation = useVigla((s) => s.navigation);
  const position = useVigla((s) => s.position);
  const speedKmh = useVigla((s) => s.speedKmh);
  const speedUnit = useVigla((s) => s.preferences.speed_unit);
  const officialRadars = useVigla((s) => s.officialRadars);
  const speedLimit = useSpeedLimit();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const eta = useMemo(() => {
    if (!navigation) return "--:--";
    const d = new Date(now + navigation.durationRemainingS * 1000);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }, [navigation, now]);

  const gps = useMemo(() => {
    if (!position) return { label: t("motoNav.gpsNone"), Icon: SignalLow, tone: "warn" as const };
    const age = now - position.timestamp;
    if (age > 15000) return { label: t("motoNav.gpsWeak"), Icon: SignalLow, tone: "warn" as const };
    if (age > 5000) return { label: t("motoNav.gpsFair"), Icon: SignalMedium, tone: "ok" as const };
    return { label: t("motoNav.gpsStrong"), Icon: Signal, tone: "ok" as const };
  }, [position, now, t]);

  const saveData =
    typeof navigator !== "undefined" &&
    !!(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;

  if (!navigation || navigation.arrived) return null;

  const step = navigation.steps[navigation.currentStepIndex];

  return (
    <>
      {/* Top chips: SPEED + ETA */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[700] p-3">
        <div className="pointer-events-auto flex gap-2">
          <MotoChip
            value={formatSpeed(speedKmh, speedUnit)}
            label={speedUnit === "mph" ? "MPH" : "KM/H"}
            limit={speedLimit}
            over={speedLimit != null && speedKmh > speedLimit}
          />
          <MotoChip value={eta} label={t("motoNav.etaLabel")} />
        </div>

        {/* Status badges — dynamic values */}
        <div className="pointer-events-auto mt-2 flex flex-col items-start gap-1.5">
          <MotoBadge Icon={gps.Icon} text={gps.label} tone={gps.tone} />
          <MotoBadge
            Icon={Radar}
            text={t("motoNav.radars", { n: officialRadars.length })}
            tone="ok"
          />
          <MotoBadge
            Icon={Wifi}
            text={saveData ? t("motoNav.saverOn") : t("motoNav.saverOff")}
            tone={saveData ? "warn" : "ok"}
          />
        </div>
      </div>

      {/* Alert / Report button — the ONLY solid orange floating control */}
      {onReport && (
        <div className="pointer-events-none absolute bottom-56 right-3 z-[650]">
          <button
            type="button"
            aria-label={t("motoNav.reportHazard")}
            onClick={onReport}
            className="vigla-moto-alert pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_8px_22px_rgba(255,106,26,0.55)] active:scale-95"
            style={{ background: "var(--moto-orange, #ff6a1a)" }}
          >
            <AlertTriangle className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>
      )}

      <RouteBar moto />
      <HazardAlertBanner moto />

      {/* Bottom instruction panel */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[700]">
        <div
          className="pointer-events-auto flex items-center gap-4 px-5 py-5"
          style={{
            background: "var(--moto-panel, #14171b)",
            borderTop: "1px solid var(--moto-line, #242830)",
            color: "var(--moto-text, #eef1f4)",
          }}
        >
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center"
            style={{ color: "var(--moto-orange, #ff6a1a)" }}
          >
            <ArrowUp className="h-12 w-12" strokeWidth={2.6} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="line-clamp-2 text-[1.65rem] font-bold leading-tight tracking-tight"
              style={{ color: "var(--moto-text, #eef1f4)" }}
            >
              {step?.instruction ?? t("navigation.followRoad")}
            </div>
            <div
              className="mt-1 text-sm font-medium"
              style={{ color: "var(--moto-text-dim, #8b9299)" }}
            >
              {t("navigation.in", { distance: formatDistance(navigation.distanceToNextManeuverM) })}
              <span className="mx-2 opacity-40">·</span>
              {(navigation.distanceRemainingM / 1000).toFixed(1)} km
            </div>
            <div className="mt-2">
              <TrafficSignalAhead moto />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MotoChip({
  value,
  label,
  limit,
  over,
}: {
  value: string;
  label: string;
  limit?: number | null;
  over?: boolean;
}) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center rounded-2xl px-4 py-2.5 tabular-nums"
      style={{
        background: "var(--moto-panel, #14171b)",
        border: "1px solid var(--moto-line, #242830)",
        color: "var(--moto-text, #eef1f4)",
      }}
    >
      {limit != null && (
        <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#e2313f] bg-white text-[11px] font-bold text-slate-900">
          {limit}
        </span>
      )}
      <span
        className="text-[1.9rem] font-bold leading-none tracking-tight"
        style={
          over
            ? { color: "#e2313f", textShadow: "0 0 12px rgba(226,49,63,0.45)" }
            : undefined
        }
      >
        {value}
      </span>
      <span
        className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--moto-text-dim, #8b9299)" }}
      >
        {label}
      </span>
    </div>
  );
}

function MotoBadge({
  Icon,
  text,
  tone,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  text: string;
  tone: "ok" | "warn";
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur"
      style={{
        background: "color-mix(in oklab, var(--moto-panel, #14171b) 85%, transparent)",
        border: "1px solid var(--moto-line, #242830)",
        color:
          tone === "warn"
            ? "var(--moto-orange-strong, #ff8a3d)"
            : "var(--moto-text-dim, #8b9299)",
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{text}</span>
    </div>
  );
}
