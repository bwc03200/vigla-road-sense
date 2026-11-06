import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowUpLeft, ArrowUpRight, CornerDownLeft, CornerDownRight, Heart, AlertTriangle, MessageCircle, Route, Volume2, VolumeX, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    { Icon: AlertTriangle, label: t("sillaxe.nearbyHazards"), count: hazards, action: onReport },
    { Icon: MessageCircle, label: t("navigation.alerts"), count: messages, action: () => setAlertsOpen(v => !v) },
    { Icon: Route, label: t("navigation.itinerary"), count: stops, action: onItinerary },
  ];
  return <div className="sillaxe-right">
    {entries.map(({ Icon, label, count, action }) => <div className="sillaxe-counter" key={label}>
      <Button variant="ghost" size="icon" className="sillaxe-round" title={label} aria-label={label} onClick={action} disabled={!action}><Icon /></Button>
      <span className="tabular-nums">{count}</span>
    </div>)}
    {alertsOpen && <div className="sillaxe-alert-detail sillaxe-panel"><strong>{t("navigation.alerts")}: {messages}</strong>
      {convoyAlerts.slice(-3).map(a => <div key={a.id}>{a.payload.text ?? a.kind}</div>)}
    </div>}
  </div>;
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
    <div className="sillaxe-eta-cell sillaxe-arrival"><strong className="tabular-nums">{eta}</strong><span>{t("sillaxe.arrival")}</span></div>
    <div className="sillaxe-eta-cell"><strong className="tabular-nums">{Math.max(0, Math.ceil(navigation.durationRemainingS / 60))}</strong><span>{t("common.min")}</span></div>
    <div className="sillaxe-eta-cell"><strong className="tabular-nums">{(Math.max(0, navigation.distanceRemainingM) / 1000).toFixed(1)}</strong><span>{t("common.km")}</span></div>
    <Button variant="ghost" size="icon" className="sillaxe-round sillaxe-voice" title={t("sillaxe.voice")} aria-label={t("sillaxe.voice")} aria-pressed={voice} onClick={() => { if (voice) cancelSpeech(); onVoice(); }}>{voice ? <Volume2 /> : <VolumeX />}</Button>
    <Button variant="ghost" size="icon" className="sillaxe-round sillaxe-stop" title={t("navigation.stop")} aria-label={t("navigation.stop")} onClick={onStop}><X /></Button>
    {navigation.recalculating && <span className="sillaxe-recalculating"><Loader2 className="size-3 animate-spin" />{t("navigation.recalculating")}</span>}
  </div>;
}