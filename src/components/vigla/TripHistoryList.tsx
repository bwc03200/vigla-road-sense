import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Search, Trash2, Play, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouteWaypoint } from "@/hooks/useRouteWaypoint";
import {
  clearTrips,
  deleteTrip,
  formatTripDate,
  formatTripDistance,
  formatTripDuration,
  loadTrips,
  subscribeTrips,
  type SavedTrip,
} from "@/lib/trip-history";

export function TripHistoryList({
  userId,
  onReplayed,
}: {
  userId: string;
  onReplayed?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [query, setQuery] = useState("");
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const { routeDirectToPOI } = useRouteWaypoint();

  useEffect(() => {
    const refresh = () => setTrips(loadTrips(userId));
    refresh();
    return subscribeTrips(refresh);
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((tr) => tr.endName.toLowerCase().includes(q));
  }, [trips, query]);

  async function replay(trip: SavedTrip) {
    setReplayingId(trip.id);
    const res = await routeDirectToPOI({
      name: trip.endName,
      lat: trip.endLat,
      lng: trip.endLng,
      type: "restaurant",
    });
    setReplayingId(null);
    if (res) onReplayed?.();
  }

  function remove(trip: SavedTrip) {
    if (!window.confirm(t("tripHistory.confirmDelete"))) return;
    deleteTrip(userId, trip.id);
    toast.success(t("tripHistory.deleted"));
  }

  function removeAll() {
    if (!window.confirm(t("tripHistory.confirmClear"))) return;
    clearTrips(userId);
    toast.success(t("tripHistory.cleared"));
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("tripHistory.searchPlaceholder")}
            aria-label={t("tripHistory.searchPlaceholder")}
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-[#FF6B35]"
          />
        </div>
        {trips.length > 0 && (
          <Button
            variant="outline"
            className="h-11 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={removeAll}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t("tripHistory.clearAll")}
          </Button>
        )}
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
            <div className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">
              {formatTripDate(trip.timestamp, i18n.language ?? "fr")}
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{trip.startName}</span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2 break-words">{trip.endName}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatTripDistance(trip.distanceM)} · {formatTripDuration(trip.durationS)}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => replay(trip)}
                disabled={replayingId === trip.id}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                {replayingId === trip.id ? t("common.loading") : t("tripHistory.replay")}
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
