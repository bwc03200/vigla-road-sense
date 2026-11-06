import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowUpLeft, ArrowUpRight, CornerDownLeft, CornerDownRight, Heart, AlertTriangle, MessageCircle, Route, Volume2, VolumeX, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVigla } from "@/lib/vigla-store";
import { supabase } from "@/integrations/supabase/client";
import { formatDistance, formatSpeed } from "@/lib/geo";
import { cancelSpeech } from "@/lib/speech";
import { isVigilanceInRange, vigilanceProgress, VIGILANCE_DURATION_MS } from "@/lib/navigation-hud";
import type { RouteMilestone } from "@/hooks/useRouteMilestones";
import type { ActiveNavigation, RouteStep, SpeedUnit } from "@/types/vigla";

function ManeuverIcon({ step }: { step?: RouteStep }) {
  const instruction = step?.instruction.toLowerCase() ?? "";
  const Icon = /gauche|left|links/.test(instruction)
    ? (/léger|slight/.test(instruction) ? ArrowUpLeft : CornerDownLeft)
    : /droite|right|rechts/.test(instruction)
      ? (/léger|slight/.test(instruction) ? ArrowUpRight : CornerDownRight) : ArrowUp;
  return <Icon aria-hidden className="sillaxe-turn-icon" strokeWidth={3} />;
}

export function NavigationTopBar({ navigation, eta, onStop }: { navigation: ActiveNavigation; eta: string; onStop: () => void }) {
  const { t } = useTranslation();
  const step = navigation.steps[navigation.currentStepIndex];
  return <div className="sillaxe-top sillaxe-panel" aria-label={t("sillaxe.itinerary")}>
    <div className="sillaxe-maneuver"><ManeuverIcon step={step} /><div className="min-w-0">
      <div className="sillaxe-turn-distance tabular-nums">{formatDistance(navigation.distanceToNextManeuverM)}</div>
      <div className="sillaxe-road" title={step?.instruction}>{step?.instruction ?? t("navigation.followRoad")}</div>
    </div></div>
    <div className="sillaxe-top-actions"><span className="tabular-nums">{eta}</span>
      <Button variant="ghost" size="icon" className="sillaxe-icon-button" title={t("navigation.stop")} aria-label={t("navigation.stop")} onClick={onStop}><X /></Button>
    </div>
  </div>;
}

export function NavigationSpeedHUD({ speed, unit, limit }: { speed: number; unit: SpeedUnit; limit: number | null }) {
  const { t } = useTranslation();
  const over = limit !== null && speed > limit;
  return <div className={`sillaxe-speed${over ? " sillaxe-speed-over" : ""}`} aria-label={t("sillaxe.speed")}>
    {limit !== null && <div className="sillaxe-limit" title={t("sillaxe.radarLimit")}>{formatSpeed(limit, unit)}</div>}
    <div className="sillaxe-speed-disc"><span className="sillaxe-speed-value tabular-nums">{formatSpeed(speed, unit)}</span><span className="sillaxe-speed-unit">{unit === "mph" ? "mph" : "km/h"}</span></div>
  </div>;
}

function RightHUDCounter({ Icon, label, count, action, warning, expanded }: {
  Icon: typeof Heart; label: string; count: number | string; action?: () => void; warning?: boolean; expanded?: boolean;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const clearHold = () => { clearTimeout(holdTimer.current); };
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  return <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" className={`sillaxe-round sillaxe-counter-button${warning ? " sillaxe-counter-warning" : ""}`}
        aria-label={label} aria-expanded={expanded} disabled={!action}
        onPointerDown={event => {
          held.current = false;
          if (event.pointerType === "touch") holdTimer.current = setTimeout(() => { held.current = true; setTooltipOpen(true); }, 500);
        }}
        onPointerUp={clearHold} onPointerCancel={() => { clearHold(); setTooltipOpen(false); }}
        onPointerLeave={() => { clearHold(); setTooltipOpen(false); }}
        onClick={() => { if (held.current) { held.current = false; return; } setTooltipOpen(false); action?.(); }}>
        <Icon aria-hidden="true" strokeWidth={1.8} />
        <span key={count} className="sillaxe-counter-value tabular-nums" aria-hidden="true">{count}</span>
        <span className="sr-only">{count}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="left" sideOffset={12} className="sillaxe-counter-tooltip">{label}</TooltipContent>
  </Tooltip>;
}

export function NavigationRightHUD({ hazards, messages, stops, onReport, onItinerary, onHistory }: {
  hazards: number; messages: number; stops: number; onReport?: () => void; onItinerary: () => void; onHistory?: () => void;
}) {
  const { t } = useTranslation();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const convoyAlerts = useVigla(s => s.convoyAlerts);
  const { data: favorites } = useQuery({
    queryKey: ["sillaxe-favorite-count"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { count, error } = await supabase.from("saved_trips").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("is_favorite", true);
      if (error) return null;
      return count;
    }, staleTime: 30_000,
  });
  const entries = [
    { Icon: Heart, label: t("sillaxe.favorites"), count: favorites ?? "—", action: onHistory },
    { Icon: AlertTriangle, label: t("sillaxe.nearbyHazards"), count: hazards, action: onReport, warning: hazards > 0 },
    { Icon: MessageCircle, label: t("tabs.convoy"), count: messages, action: () => setAlertsOpen(v => !v), expanded: alertsOpen },
    { Icon: Route, label: t("navigation.itinerary"), count: stops, action: onItinerary },
  ];
  return <TooltipProvider delayDuration={250}><div className="sillaxe-right" role="group" aria-label={t("navigation.itinerary")}>
    {entries.map(entry => <RightHUDCounter key={entry.label} {...entry} />)}
    {alertsOpen && <div className="sillaxe-alert-detail sillaxe-panel" role="region" aria-label={t("tabs.convoy")}>
      <div className="sillaxe-alert-detail-heading"><strong>{t("navigation.alerts")}: {messages}</strong>
        <Button variant="ghost" size="icon" className="sillaxe-icon-button" aria-label={t("common.close")} onClick={() => setAlertsOpen(false)}><X /></Button>
      </div>
      {convoyAlerts.slice(-3).map(a => <div key={a.id}>{a.payload.text ?? a.kind}</div>)}
    </div>}
  </div></TooltipProvider>;
}

export function NavigationAlertBar({ milestone }: { milestone: RouteMilestone | undefined }) {
  const { t } = useTranslation();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const id = milestone?.id;
  useEffect(() => {
    if (!id) { setDismissedId(null); return; }
    setCollapsed(false);
    const timer = window.setTimeout(() => setDismissedId(id), VIGILANCE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [id]);
  if (!milestone || dismissedId === id || !isVigilanceInRange(milestone.kind, milestone.distanceM)) return null;
  return <div className="sillaxe-vigilance sillaxe-panel" role="status">
    <div className="sillaxe-vigilance-heading"><AlertTriangle className="size-4 shrink-0" /><strong>{t("sillaxe.vigilance")}</strong>
      <Button variant="ghost" size="icon" className="sillaxe-mini" title={t("sillaxe.collapse")} aria-label={t("sillaxe.collapse")} aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}>{collapsed ? <ChevronDown /> : <ChevronUp />}</Button>
      <Button variant="ghost" size="icon" className="sillaxe-mini" title={t("common.close")} aria-label={t("sillaxe.dismissAlert")} onClick={() => setDismissedId(milestone.id)}><X /></Button>
    </div>
    {!collapsed && <><div className="sillaxe-vigilance-caption">{milestone.label} · {formatDistance(milestone.distanceM)}</div>
      <progress className="sillaxe-progress" max={100} value={vigilanceProgress(milestone.distanceM, milestone.kind)} aria-label={t("sillaxe.proximity")} /></>}
  </div>;
}

export function NavigationETABar({ navigation, eta, onStop, onVoice }: { navigation: ActiveNavigation; eta: string; onStop: () => void; onVoice: () => void }) {
  const { t } = useTranslation();
  const voice = useVigla(s => s.preferences.voice_alerts);
  return <div className="sillaxe-eta sillaxe-panel" aria-label={t("motoNav.etaLabel")}>
    <div className="sillaxe-eta-cell sillaxe-arrival"><strong key={eta} className="tabular-nums">{eta}</strong><span>{t("sillaxe.arrival")}</span></div>
    <div className="sillaxe-eta-cell"><strong key={Math.ceil(navigation.durationRemainingS / 60)} className="tabular-nums">{Math.max(0, Math.ceil(navigation.durationRemainingS / 60))}</strong><span>{t("common.min")}</span></div>
    <div className="sillaxe-eta-cell"><strong key={(navigation.distanceRemainingM / 1000).toFixed(1)} className="tabular-nums">{(Math.max(0, navigation.distanceRemainingM) / 1000).toFixed(1)}</strong><span>{t("common.km")}</span></div>
    <div className="sillaxe-eta-actions">
      <Button variant="ghost" size="icon" className="sillaxe-round sillaxe-voice" title={t("sillaxe.voice")} aria-label={t("sillaxe.voice")} aria-pressed={voice} onClick={() => { if (voice) cancelSpeech(); onVoice(); }}>{voice ? <Volume2 /> : <VolumeX />}</Button>
      <Button variant="ghost" size="icon" className="sillaxe-round sillaxe-stop" title={t("navigation.stop")} aria-label={t("navigation.stop")} onClick={onStop}><X /></Button>
    </div>
    {navigation.recalculating && <span className="sillaxe-recalculating"><Loader2 className="size-3 animate-spin" />{t("navigation.recalculating")}</span>}
  </div>;
}