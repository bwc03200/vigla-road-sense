import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigation, X, AlertTriangle, Loader2, SignalLow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/vigla/TopBar";
import { useVigla } from "@/lib/vigla-store";
import { useNavigationEngine } from "@/hooks/useNavigationEngine";
import { formatDistance } from "@/lib/geo";
import type { ActiveNavigation } from "@/types/vigla";

function formatDuration(s: number, minLabel: string): string {
  const m = Math.max(0, Math.round(s / 60));
  if (m < 60) return `${m} ${minLabel}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

export function StartTripBar() {
  const { t } = useTranslation();
  const route = useVigla((s) => s.route);
  const navigation = useVigla((s) => s.navigation);
  const setRoute = useVigla((s) => s.setRoute);
  const setNavigation = useVigla((s) => s.setNavigation);

  if (!route || navigation) return null;

  function start() {
    if (!route) return;
    const coords = Array.isArray(route.coords) ? route.coords : [];
    const steps = Array.isArray(route.steps) ? route.steps : [];
    if (coords.length < 2) return;
    const nav: ActiveNavigation = {
      routeCoords: coords,
      remainingCoords: coords,
      consumedCoords: [],
      steps,
      currentStepIndex: 0,
      distanceRemainingM: route.distanceM ?? 0,
      durationRemainingS: route.durationS ?? 0,
      distanceToNextManeuverM: steps[0]?.distanceMeters ?? 0,
      offRouteM: 0,
      offRouteSince: null,
      recalculating: false,
      arrived: false,
      startedAt: new Date().toISOString(),
      alertsReceived: 0,
    };
    setNavigation(nav);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[700] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {route.destination.label}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {(route.distanceM / 1000).toFixed(1)} km ·{" "}
              {formatDuration(route.durationS, t("common.min"))}
              {route.hazardIds.length > 0 &&
                t("route.hazardsSuffix", { n: route.hazardIds.length })}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-12 flex-1" onClick={() => setRoute(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            className="h-12 flex-[2] bg-primary text-primary-foreground"
            onClick={start}
          >
            <Navigation className="mr-2 h-4 w-4" />
            {t("route.startTrip")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NavigationOverlay() {
  useNavigationEngine();
  const { t } = useTranslation();
  const navigation = useVigla((s) => s.navigation);
  const route = useVigla((s) => s.route);
  const position = useVigla((s) => s.position);
  const setNavigation = useVigla((s) => s.setNavigation);
  const setRoute = useVigla((s) => s.setRoute);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!navigation) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [navigation]);

  if (!navigation || !route) return null;

  const startedAtMs = navigation.startedAt
    ? new Date(navigation.startedAt).getTime()
    : now;
  const navAgeMs = now - startedAtMs;
  const gpsWeak =
    navAgeMs > 10000 && (position ? now - position.timestamp > 10000 : true);

  function stop() {
    setNavigation(null);
    setRoute(null);
  }

  if (navigation.arrived) {
    return <ArrivalScreen onClose={stop} />;
  }

  const step = navigation.steps[navigation.currentStepIndex];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[700] flex flex-col gap-2 p-3">
      <div className="pointer-events-auto rounded-2xl bg-slate-900 text-white shadow-[0_12px_32px_rgba(15,23,42,0.35)]">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF6B35] text-white">
            <Navigation className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">
              {t("navigation.in", { distance: formatDistance(navigation.distanceToNextManeuverM) })}
            </div>
            <div className="mt-1 line-clamp-2 text-2xl font-bold leading-tight tracking-tight">
              {step?.instruction ?? t("navigation.followRoad")}
            </div>
          </div>
          <button
            onClick={stop}
            aria-label={t("navigation.stop")}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[11px]">
          <div className="tabular-nums text-white/70">
            <span className="font-medium text-white/85">
              {(navigation.distanceRemainingM / 1000).toFixed(1)} km
            </span>
            <span className="mx-1 text-white/30">·</span>
            <span>
              {formatDuration(navigation.durationRemainingS, t("common.min"))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {navigation.recalculating && (
              <span className="flex items-center gap-1 text-white/70">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("navigation.recalculating")}
              </span>
            )}
            {gpsWeak && (
              <span className="flex items-center gap-1 text-amber-300">
                <SignalLow className="h-3 w-3" />
                {t("navigation.gpsWeak")}
              </span>
            )}
          </div>
        </div>
      </div>
      <TopBar embedded />
    </div>
  );
}

function ArrivalScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigation = useVigla((s) => s.navigation)!;
  const route = useVigla((s) => s.route);

  useEffect(() => {
    const id = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(id);
  }, [onClose]);

  const durationMs = Date.now() - new Date(navigation.startedAt).getTime();
  const durationMin = Math.max(1, Math.round(durationMs / 60000));
  const distanceKm = ((route?.distanceM ?? 0) / 1000).toFixed(1);

  return (
    <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/95 p-6 backdrop-blur">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{t("navigation.arrivedTitle")}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">
              {t("navigation.duration")}
            </div>
            <div className="mt-1 font-semibold text-slate-900">
              {durationMin} {t("common.min")}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">
              {t("navigation.distance")}
            </div>
            <div className="mt-1 font-semibold text-slate-900">{distanceKm} km</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">
              {t("navigation.alerts")}
            </div>
            <div className="mt-1 font-semibold text-slate-900">
              {navigation.alertsReceived}
            </div>
          </div>
        </div>
        <Button className="mt-6 h-12 w-full" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}
