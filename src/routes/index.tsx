import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { User } from "@supabase/supabase-js";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHazards } from "@/hooks/useHazards";
import { useOfficialRadars } from "@/hooks/useOfficialRadars";
import { useAlerts } from "@/hooks/useAlerts";
import { useTripTracker } from "@/hooks/useTripTracker";
import { useCrashDetection } from "@/hooks/useCrashDetection";
import { useEmergencyContacts } from "@/hooks/useEmergencyContacts";
import { useConvoy } from "@/hooks/useConvoy";
import { useRoadbooks } from "@/hooks/useRoadbooks";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineHazardSync } from "@/hooks/useOfflineHazardSync";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { usePersistActiveNavigation, useResumePrompt } from "@/hooks/useNavigationResume";
import { useVigla } from "@/lib/vigla-store";
import { MapView } from "@/components/vigla/MapView";
import { HazardFilters } from "@/components/vigla/HazardFilters";

import { TopBar } from "@/components/vigla/TopBar";
import { ReportGrid } from "@/components/vigla/ReportGrid";
import { OfflineBadge } from "@/components/vigla/OfflineBadge";
import { InstallBanner } from "@/components/vigla/InstallPWA";

import { BottomTabs, type Tab } from "@/components/vigla/BottomTabs";
import { RoutePlanner } from "@/components/vigla/RoutePlanner";
import { NavigationOverlay, StartTripBar } from "@/components/vigla/NavigationOverlay";
import { NavigationErrorBoundary } from "@/components/vigla/NavigationErrorBoundary";
import { CrashAlertOverlay } from "@/components/vigla/CrashAlertOverlay";
import { AutoProtectBanner, ProtectionBadge } from "@/components/vigla/AutoProtectBanner";
import { ConvoyPanel } from "@/components/vigla/ConvoyPanel";
import { ConvoyReactionBar, ConvoyMessageBubbles } from "@/components/vigla/ConvoyReactionBar";
import { EmergencyContactsScreen } from "@/components/vigla/EmergencyContactsScreen";
import { RoadbookList } from "@/components/vigla/RoadbookList";
import { HistoryList } from "@/components/vigla/HistoryList";
import { SettingsScreen } from "@/components/vigla/SettingsScreen";
import { usePreferences } from "@/hooks/usePreferences";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LogOut, Shield, Navigation, Settings as SettingsIcon } from "lucide-react";
import { formatDistance } from "@/lib/geo";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "VIGLA — Alertes routières temps réel" },
      {
        name: "description",
        content:
          "VIGLA — application communautaire d'alerte de zones de danger routières : radars, accidents, travaux, obstacles. Temps réel, mobile et tableau de bord.",
      },
      { property: "og:title", content: "VIGLA — Alertes routières temps réel" },
      {
        property: "og:description",
        content: "Signalez et évitez les radars, accidents, travaux et obstacles en temps réel.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUser(data.session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user === null) navigate({ to: "/auth" });
  }, [user, navigate]);

  if (user === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!user) return null;

  return <ViglaApp userId={user.id} email={user.email ?? ""} />;
}

function ViglaApp({ userId, email }: { userId: string; email: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("map");
  const [showRoute, setShowRoute] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    installGlobalErrorLogging();
    setLoggerUser(userId);
    return () => setLoggerUser(null);
  }, [userId]);
  useGeolocation();
  useServiceWorker();
  useOnlineStatus();
  useOfflineHazardSync();
  useHazards();
  useOfficialRadars();
  useEmergencyContacts(userId);
  usePreferences(userId);
  useRoadbooks(userId);
  useConvoy(userId);
  const tracker = useTripTracker(userId);

  const patchNavigation = useVigla((s) => s.patchNavigation);
  useAlerts((label, distance) => {
    tracker.incrementAlerts();
    const nav = useVigla.getState().navigation;
    if (nav) patchNavigation({ alertsReceived: nav.alertsReceived + 1 });
    toast(`⚠️ ${label}`, { description: t("map.in", { distance: formatDistance(distance) }), duration: 5000 });
  });
  const geoError = useVigla((s) => s.geoError);
  const route = useVigla((s) => s.route);
  const navigation = useVigla((s) => s.navigation);
  const convoy = useVigla((s) => s.convoy);
  const navActive = !!navigation && !navigation.arrived;

  useCrashDetection(navActive);
  useWakeLock(navActive);
  usePersistActiveNavigation();
  const resumePrompt = useResumePrompt();

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <Toaster position="top-center" theme="light" richColors closeButton />
      <CrashAlertOverlay />
      <main className="fixed inset-x-0 top-0 bottom-16" style={{ height: "calc(100dvh - 4rem)" }}>
        {tab === "map" && (
          <div className="relative h-full w-full">
            <MapView />
            <TopBar />
            <HazardFilters />

            <ProtectionBadge />
            <OfflineBadge />
            <InstallBanner />

            <AutoProtectBanner />
            <ConvoyMessageBubbles />
            {!route && !navActive && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[600] flex justify-center px-4">
                <button
                  onClick={() => setShowRoute(true)}
                  className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,107,53,0.35)]"
                >
                  <Navigation className="h-4 w-4" />
                  {t("route.cta")}
                </button>
              </div>
            )}
            <NavigationErrorBoundary
              onReset={() => {
                useVigla.setState({ navigation: null, route: null });
              }}
            >
              <StartTripBar />
              <NavigationOverlay />
            </NavigationErrorBoundary>
            {navActive && convoy && <ConvoyReactionBar userId={userId} />}
            {showRoute && <RoutePlanner onClose={() => setShowRoute(false)} />}
            {geoError && <GeoErrorOverlay code={geoError} />}
            {resumePrompt.candidate && !navActive && !route && (
              <ResumeBanner
                label={resumePrompt.candidate.route.destination.label}
                onResume={resumePrompt.resume}
                onDismiss={resumePrompt.dismiss}
              />
            )}
          </div>
        )}

        {tab === "report" && (
          <div className="h-full overflow-y-auto pt-6">
            <h2 className="px-4 text-lg font-semibold">{t("hazard.report.title")}</h2>
            <p className="px-4 text-sm text-muted-foreground">{t("hazard.report.subtitle")}</p>
            <ReportGrid onReported={() => setTab("map")} />
          </div>
        )}
        {tab === "roadbooks" && (
          <div className="h-full overflow-y-auto pt-6">
            <h2 className="px-4 text-lg font-semibold">{t("roadbooks.title")}</h2>
            <RoadbookList userId={userId} />
          </div>
        )}
        {tab === "convoy" && (
          <div className="h-full overflow-y-auto pt-6">
            <h2 className="px-4 text-lg font-semibold">{t("convoy.title")}</h2>
            <ConvoyPanel userId={userId} />
          </div>
        )}
        {tab === "profile" && (
          <div className="h-full overflow-y-auto">
            <div className="p-6 pb-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{email}</div>
                  <div className="text-xs text-muted-foreground">{t("profile.account")}</div>
                </div>
              </div>
              <Button
                variant="outline"
                className="mb-2 w-full h-11"
                onClick={() => setShowSettings(true)}
              >
                <SettingsIcon className="mr-2 h-4 w-4" />
                {t("profile.viewSettings")}
              </Button>
              <Button
                variant="secondary"
                className="w-full h-11"
                onClick={async () => { await supabase.auth.signOut(); }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("profile.signOut")}
              </Button>
            </div>
            <EmergencyContactsScreen userId={userId} />
            <div>
              <div className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("profile.tripHistory")}
              </div>
              <HistoryList />
            </div>
          </div>
        )}
      </main>
      <BottomTabs value={tab} onChange={setTab} />
      {showSettings && (
        <div className="fixed inset-0 z-[900] bg-slate-50">
          <SettingsScreen userId={userId} email={email} onBack={() => setShowSettings(false)} />
        </div>
      )}
    </div>
  );
}

function ResumeBanner({
  label, onResume, onDismiss,
}: { label: string; onResume: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-[700] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
        <div className="mb-3">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            {t("navigation.resumeCaption")}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">
            {t("navigation.resumeQuestion", { label })}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-11 flex-1" onClick={onDismiss}>
            {t("navigation.resumeNo")}
          </Button>
          <Button className="h-11 flex-[2] bg-primary text-primary-foreground" onClick={onResume}>
            <Navigation className="mr-2 h-4 w-4" />
            {t("navigation.resumeYes")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GeoErrorOverlay({ code }: { code: string }) {
  const { t } = useTranslation();
  const setGeoError = useVigla((s) => s.setGeoError);
  const msg =
    code === "denied" ? t("geoError.denied")
    : code === "unsupported" ? t("geoError.unsupported")
    : t("geoError.unavailable");

  function retry() {
    setGeoError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => window.location.reload(),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setGeoError("denied");
          else setGeoError("unavailable");
        },
        { enableHighAccuracy: true },
      );
    }
  }

  return (
    <div className="absolute inset-0 z-[800] flex items-center justify-center bg-background/95 p-6 backdrop-blur">
      <div className="max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/15 text-danger">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t("geoError.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
        <Button onClick={retry} className="mt-5 w-full h-12">
          {t("common.retry")}
        </Button>
      </div>
    </div>
  );
}
