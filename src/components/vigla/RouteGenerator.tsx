import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Route, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVigla } from "@/lib/vigla-store";
import { generateQuickRide, COMPASS, type Compass as CompassId } from "@/lib/route-generator";
import { buildRouteState, fetchOsrmRoute } from "@/lib/routing";
import { suggestionsNear } from "@/lib/discovery";

type Mode = "quick" | "discover";

export function RouteGenerator({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const position = useVigla((s) => s.position);
  const hazards = useVigla((s) => s.hazards);
  const setRoute = useVigla((s) => s.setRoute);
  const [mode, setMode] = useState<Mode>("quick");
  const [distance, setDistance] = useState(60);
  const [direction, setDirection] = useState<CompassId>("ALL");
  const [busy, setBusy] = useState(false);

  async function runQuickRide() {
    if (!position) return toast.error(t("hazard.report.gpsUnavailable"));
    setBusy(true);
    try {
      const result = await generateQuickRide(position.lat, position.lng, distance, direction);
      const state = buildRouteState(
        { lat: position.lat, lng: position.lng, label: t("generator.loopLabel", { km: distance }) },
        result,
        hazards,
      );
      setRoute(state);
      toast.success(t("generator.generated"), {
        description: `${(state.distanceM / 1000).toFixed(0)} km`,
      });
      onDone();
    } catch {
      toast.error(t("generator.generateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function runSuggestion(dest: { lat: number; lng: number; label: string }) {
    if (!position) return toast.error(t("hazard.report.gpsUnavailable"));
    setBusy(true);
    try {
      const result = await fetchOsrmRoute(position.lat, position.lng, dest.lat, dest.lng);
      const state = buildRouteState(dest, result, hazards);
      setRoute(state);
      toast.success(t("generator.computed"));
      onDone();
    } catch {
      toast.error(t("generator.computeFailed"));
    } finally {
      setBusy(false);
    }
  }

  const suggestions = position ? suggestionsNear(position.lat, position.lng, 6) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setMode("quick")}
          className={`rounded-lg py-2 text-sm font-medium transition ${
            mode === "quick" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <Route className="mx-auto h-4 w-4" />
          {t("generator.quickRide")}
        </button>
        <button
          onClick={() => setMode("discover")}
          className={`rounded-lg py-2 text-sm font-medium transition ${
            mode === "discover" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <Compass className="mx-auto h-4 w-4" />
          {t("generator.discover")}
        </button>
      </div>

      {mode === "quick" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-xs uppercase tracking-widest text-slate-500">{t("generator.distance")}</label>
              <span className="text-lg font-semibold text-slate-900">{distance} km</span>
            </div>
            <input
              type="range"
              min={10}
              max={300}
              step={5}
              value={distance}
              onChange={(e) => setDistance(parseInt(e.target.value))}
              className="w-full accent-[#FF6B35]"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-slate-500">
              {t("generator.direction")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDirection("ALL")}
                className={`col-span-3 rounded-xl border py-2 text-sm ${
                  direction === "ALL"
                    ? "border-[#FF6B35] bg-orange-50 text-slate-900"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {t("generator.allDirections")}
              </button>
              {COMPASS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDirection(c.id)}
                  className={`rounded-xl border py-2 text-xs ${
                    direction === c.id
                      ? "border-[#FF6B35] bg-orange-50 text-slate-900"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {t(`generator.compass.${c.id}`)}
                </button>
              ))}
            </div>
          </div>

          <Button className="h-12 w-full" onClick={runQuickRide} disabled={busy || !position}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("generator.generate")}
          </Button>
        </div>
      )}

      {mode === "discover" && (
        <div className="space-y-2">
          {suggestions.length === 0 && (
            <p className="text-sm text-slate-500">{t("generator.gpsRequiredDiscovery")}</p>
          )}
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() =>
                runSuggestion({ lat: s.destination.lat, lng: s.destination.lng, label: s.title })
              }
              disabled={busy}
              className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 disabled:opacity-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-2xl">
                🏔️
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-500">
                  {s.region} · {s.distanceKm} km · {s.durationMin} {t("common.min")}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-600">{s.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
