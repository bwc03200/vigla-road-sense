import { useTranslation } from "react-i18next";
import { Shield, X } from "lucide-react";
import { useAutoProtect } from "@/hooks/useAutoProtect";
import { useVigla } from "@/lib/vigla-store";
import type { ActiveNavigation } from "@/types/vigla";

export function AutoProtectBanner() {
  const { t } = useTranslation();
  const { suggest, dismiss } = useAutoProtect();
  const setNavigation = useVigla((s) => s.setNavigation);

  if (!suggest) return null;

  function activate() {
    const nav: ActiveNavigation = {
      routeCoords: [],
      remainingCoords: [],
      consumedCoords: [],
      steps: [],
      currentStepIndex: 0,
      distanceRemainingM: 0,
      durationRemainingS: 0,
      distanceToNextManeuverM: 0,
      offRouteM: 0,
      offRouteSince: null,
      recalculating: false,
      arrived: false,
      startedAt: new Date().toISOString(),
      alertsReceived: 0,
      protectionOnly: true,
    };
    setNavigation(nav);
    dismiss();
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-[850] flex justify-center px-3">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-[0_16px_40px_rgba(15,23,42,0.35)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF6B35]">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">{t("autoProtect.title")}</div>
          <div className="text-xs text-white/70">{t("autoProtect.cta")}</div>
        </div>
        <button
          onClick={activate}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900"
        >
          {t("autoProtect.activate")}
        </button>
        <button
          onClick={dismiss}
          aria-label={t("autoProtect.dismiss")}
          className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ProtectionBadge() {
  const { t } = useTranslation();
  const navigation = useVigla((s) => s.navigation);
  if (!navigation?.protectionOnly || navigation.arrived) return null;
  const durMin = Math.max(1, Math.round((Date.now() - new Date(navigation.startedAt).getTime()) / 60000));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-white shadow-[0_8px_24px_rgba(15,23,42,0.25)]">
        <Shield className="h-4 w-4 text-[#FF6B35]" />
        <span className="text-xs font-semibold uppercase tracking-widest">{t("autoProtect.badge")}</span>
        <span className="text-xs text-white/70">· {durMin} {t("common.min")}</span>
      </div>
    </div>
  );
}
