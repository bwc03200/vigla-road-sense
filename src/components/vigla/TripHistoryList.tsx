import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Search, Trash2, Play, ArrowRight, Star } from "lucide-react";
import { toast } from "sonner";
import { useVigla } from "@/lib/vigla-store";
import { buildRouteState, fetchOsrmRouteVia } from "@/lib/routing";
import type { RouteWaypoint } from "@/types/vigla";
import {
  deleteSavedTrip,
  listSavedTrips,
  toggleSavedTripFavorite,
  type SavedTripRow,
} from "@/lib/saved-trips";
import { formatTripDate, formatTripDistance, formatTripDuration } from "@/lib/trip-history";

export function TripHistoryList({
  userId,
  onReplayed,
}: {
  userId: string;
  onReplayed?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [trips, setTrips] = useState<SavedTripRow[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setTrips(await listSavedTrips(userId));
  }, [userId]);

  useEffect(() => {
    console.log("🟢 [HISTORY MODAL OPENED]");
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((tr) => tr.end_name.toLowerCase().includes(q));
  }, [trips, query]);

  async function recreate(trip: SavedTripRow) {
    const { position, hazards, setRoute } = useVigla.getState();
    if (!position) {
      toast.error("Position GPS indisponible");
      return;
    }
    setBusyId(trip.id);
    console.log("🟢 [TRIP RECREATED: OSRM recalc]", `${trip.start_name} → ${trip.end_name}`);
    try {
      const stops = Array.isArray(trip.waypoints) ? trip.waypoints : [];
      const waypoints: RouteWaypoint[] = [
        ...stops.map((w, i) => ({
          id: `replay-poi-${i}-${trip.id}`,
          type: "poi" as const,
          name: w.name,
          lat: w.lat,
          lon: w.lon,
        })),
        {
          id: `replay-dest-${trip.id}`,
          type: "destination" as const,
          name: trip.end_name,
          lat: trip.end_lat,
          lon: trip.end_lng,
        },
      ];
      const result = await fetchOsrmRouteVia([
        [position.lat, position.lng],
        ...waypoints.map((w) => [w.lat, w.lon] as [number, number]),
      ]);
      const destination = { lat: trip.end_lat, lng: trip.end_lng, label: trip.end_name };
      setRoute(buildRouteState(destination, result, hazards, waypoints));
      toast.success(`🚀 ${trip.end_name}`, {
        description: `${formatTripDistance(trip.distance_m)} · ${formatTripDuration(trip.duration_s)}`,
      });
      onReplayed?.();
    } catch (error) {
      console.log("🔴 [TRIP RECREATE FAILED]", error);
      toast.error("Erreur calcul route");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFavorite(trip: SavedTripRow) {
    const next = !trip.is_favorite;
    setTrips((prev) =>
      prev.map((tr) => (tr.id === trip.id ? { ...tr, is_favorite: next } : tr)),
    );
    const ok = await toggleSavedTripFavorite(trip.id, next);
    if (!ok) toast.error("Erreur favori");
    void refresh();
  }

  async function remove(trip: SavedTripRow) {
    if (!window.confirm(t("tripHistory.confirmDelete"))) return;
    const ok = await deleteSavedTrip(trip.id);
    if (ok) {
      setTrips((prev) => prev.filter((tr) => tr.id !== trip.id));
      toast.success(t("tripHistory.deleted"));
    } else {
      toast.error("Suppression impossible");
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tripHistory.searchPlaceholder")}
          aria-label={t("tripHistory.searchPlaceholder")}
          className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-[#FF6B35]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("tripHistory.empty")}</p>
        </div>
      ) : (
        filtered.map((trip) => (
          <article
            key={trip.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">
                {formatTripDate(new Date(trip.created_at).getTime(), i18n.language ?? "fr")}
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(trip)}
                aria-label="Favori"
                aria-pressed={trip.is_favorite}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <Star
                  className={
                    trip.is_favorite
                      ? "h-5 w-5 fill-[#FF8C00] text-[#FF8C00]"
                      : "h-5 w-5"
                  }
                />
              </button>
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{trip.start_name}</span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2 break-words">{trip.end_name}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatTripDistance(trip.distance_m)} · {formatTripDuration(trip.duration_s)}
              {trip.waypoints?.length ? ` · ${trip.waypoints.length} étapes` : ""}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => recreate(trip)}
                disabled={busyId === trip.id}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                {busyId === trip.id ? t("common.loading") : "Récréer"}
              </button>
              <button
                type="button"
                onClick={() => remove(trip)}
                aria-label={t("tripHistory.delete")}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
