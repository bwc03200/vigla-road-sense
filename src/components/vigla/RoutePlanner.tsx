import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, X, Loader2, Navigation, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVigla } from "@/lib/vigla-store";
import { formatDistance, haversine } from "@/lib/geo";
import { buildRouteState, fetchOsrmRoute } from "@/lib/routing";
import { RouteGenerator } from "@/components/vigla/RouteGenerator";
import { hazardLabel } from "@/lib/i18n-helpers";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

type Mode = "search" | "generate";

export function RoutePlanner({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const position = useVigla((s) => s.position);
  const hazards = useVigla((s) => s.hazards);
  const route = useVigla((s) => s.route);
  const setRoute = useVigla((s) => s.setRoute);

  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [computing, setComputing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "6");
        url.searchParams.set("addressdetails", "0");
        if (position) url.searchParams.set("countrycodes", "fr");
        const res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("nominatim");
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error(t("route.serviceUnavailable"));
        }
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, position, t]);

  async function selectDestination(r: NominatimResult) {
    if (!position) return toast.error(t("hazard.report.gpsUnavailable"));
    const destLat = parseFloat(r.lat);
    const destLng = parseFloat(r.lon);
    setComputing(true);
    setResults([]);
    try {
      const result = await fetchOsrmRoute(position.lat, position.lng, destLat, destLng);
      const state = buildRouteState(
        { lat: destLat, lng: destLng, label: r.display_name },
        result,
        hazards,
      );
      setRoute(state);
      setQuery("");
      toast.success(t("route.computed"), {
        description: t("route.computedDesc", {
          km: (state.distanceM / 1000).toFixed(1),
          n: state.hazardIds.length,
        }),
      });
      onClose();
    } catch {
      toast.error(t("route.serviceUnavailable"));
    } finally {
      setComputing(false);
    }
  }

  function cancelRoute() {
    setRoute(null);
    toast(t("route.cancelled"));
  }

  const routeHazards = route
    ? hazards
        .filter((h) => route.hazardIds.includes(h.id))
        .map((h) => {
          const start = route.coords[0];
          return {
            id: h.id,
            label: hazardLabel(h.type),
            fromStart: haversine(start[0], start[1], h.latitude, h.longitude),
          };
        })
        .sort((a, b) => a.fromStart - b.fromStart)
    : [];

  return (
    <div className="absolute inset-0 z-[850] flex items-start justify-center overflow-y-auto bg-white/95 p-4 backdrop-blur">
      <div className="w-full max-w-lg space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Navigation className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{t("route.planner")}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {route ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("route.destination")}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{route.destination.label}</div>
            </div>
            <div className="flex gap-4 text-sm text-slate-700">
              <span>{(route.distanceM / 1000).toFixed(1)} km</span>
              <span>{Math.round(route.durationS / 60)} {t("common.min")}</span>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" />
              <div>
                <div className="font-semibold text-slate-900">
                  {t("route.hazardsOnRoute", { n: route.hazardIds.length })}
                </div>
                {routeHazards.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {routeHazards.slice(0, 8).map((h) => (
                      <li key={h.id} className="flex justify-between gap-2">
                        <span>{h.label}</span>
                        <span className="tabular-nums text-slate-500">
                          {t("route.at", { distance: formatDistance(h.fromStart) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <Button variant="secondary" className="w-full h-11" onClick={cancelRoute}>
              {t("route.cancelRoute")}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setMode("search")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                  mode === "search" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                <Search className="h-4 w-4" /> {t("route.preciseTab")}
              </button>
              <button
                onClick={() => setMode("generate")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                  mode === "generate" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                <Sparkles className="h-4 w-4" /> {t("route.generateTab")}
              </button>
            </div>

            {mode === "search" ? (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("route.searchPlaceholder")}
                    className="h-12 pl-10"
                  />
                  {(searching || computing) && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                </div>
                {results.length > 0 && (
                  <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {results.map((r) => (
                      <li key={r.place_id}>
                        <button
                          onClick={() => selectDestination(r)}
                          disabled={computing}
                          className="w-full px-4 py-3 text-left text-sm text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {r.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!position && (
                  <p className="text-xs text-slate-500">{t("route.gpsRequired")}</p>
                )}
              </>
            ) : (
              <RouteGenerator onDone={onClose} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
