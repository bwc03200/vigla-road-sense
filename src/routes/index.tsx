import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { useVigla } from "@/lib/vigla-store";
import { MapView } from "@/components/vigla/MapView";
import { TopBar } from "@/components/vigla/TopBar";
import { ReportGrid } from "@/components/vigla/ReportGrid";
import { OfflineBadge } from "@/components/vigla/OfflineBadge";
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
import { Button } from "@/components/ui/button";
import { AlertTriangle, LogOut, Shield, Navigation } from "lucide-react";
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
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!user) return null;

  return <ViglaApp userId={user.id} email={user.email ?? ""} />;
}

function ViglaApp({ userId, email }: { userId: string; email: string }) {
  const [tab, setTab] = useState<Tab>("map");
  const [showRoute, setShowRoute] = useState(false);
  useGeolocation();
  useHazards();
  useOfficialRadars();
  useEmergencyContacts(userId);
  useRoadbooks(userId);
  useConvoy(userId);
  const tracker = useTripTracker(userId);
  const patchNavigation = useVigla((s) => s.patchNavigation);
  useAlerts((label, distance) => {
    tracker.incrementAlerts();
    const nav = useVigla.getState().navigation;
    if (nav) patchNavigation({ alertsReceived: nav.alertsReceived + 1 });
    toast(`⚠️ ${label}`, { description: `À ${formatDistance(distance)}`, duration: 5000 });
  });
  const geoError = useVigla((s) => s.geoError);
  const route = useVigla((s) => s.route);
  const navigation = useVigla((s) => s.navigation);
  const convoy = useVigla((s) => s.convoy);
  const navActive = !!navigation && !navigation.arrived;

  // Crash detection runs whenever nav (or protection) is active.
  useCrashDetection(navActive);

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <Toaster position="top-center" theme="light" richColors closeButton />
      <CrashAlertOverlay />
      <main className="fixed inset-x-0 top-0 bottom-16" style={{ height: "calc(100dvh - 4rem)" }}>
        {tab === "map" && (
          <div className="relative h-full w-full">
            <MapView />
            {!navActive && <TopBar />}
            <ProtectionBadge />
            <OfflineBadge />
            <AutoProtectBanner />
            <ConvoyMessageBubbles />
            {!route && !navActive && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[600] flex justify-center px-4">
                <button
                  onClick={() => setShowRoute(true)}
                  className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,107,53,0.35)]"
                >
                  <Navigation className="h-4 w-4" />
                  Itinéraire
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
          </div>
        )}

        {tab === "report" && (
          <div className="h-full overflow-y-auto pt-6">
            <h2 className="px-4 text-lg font-semibold">Signaler une zone</h2>
            <p className="px-4 text-sm text-muted-foreground">
              Un appui envoie immédiatement le signalement à votre position GPS actuelle.
            </p>
            <ReportGrid onReported={() => setTab("map")} />
          </div>
        )}
        {tab === "roadbooks" && (
          <div className="h-full overflow-y-auto pt-6">
            <h2 className="px-4 text-lg font-semibold">Roadbooks</h2>
            <RoadbookList userId={userId} />
          </div>
        )}
        {tab === "convoy" && (
          <div className="h-full overflow-y-auto pt-6">
            <h2 className="px-4 text-lg font-semibold">Convoi</h2>
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
                  <div className="text-xs text-muted-foreground">Compte VIGLA</div>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full h-11"
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </Button>
            </div>
            <EmergencyContactsScreen userId={userId} />
            <div>
              <div className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Historique des trajets
              </div>
              <HistoryList />
            </div>
          </div>
        )}
      </main>
      <BottomTabs value={tab} onChange={setTab} />
    </div>
  );
}

function GeoErrorOverlay({ code }: { code: string }) {
  const setGeoError = useVigla((s) => s.setGeoError);
  const msg =
    code === "denied"
      ? "L'accès à votre position est refusé. Autorisez la géolocalisation dans les réglages du navigateur (icône de cadenas dans la barre d'adresse), puis réessayez."
      : code === "unsupported"
        ? "Votre navigateur ne prend pas en charge la géolocalisation. Essayez Chrome, Safari ou Firefox à jour."
        : "Position GPS momentanément indisponible. Vérifiez que le GPS est activé.";

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
        <h2 className="text-lg font-semibold text-foreground">Géolocalisation requise</h2>
        <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
        <Button onClick={retry} className="mt-5 w-full h-12">
          Réessayer
        </Button>
      </div>
    </div>
  );
}
