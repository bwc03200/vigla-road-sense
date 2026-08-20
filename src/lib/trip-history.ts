export interface SavedTrip {
  id: string;
  startName: string;
  startLat: number;
  startLng: number;
  endName: string;
  endLat: number;
  endLng: number;
  distanceM: number;
  durationS: number;
  timestamp: number;
}

const MAX_TRIPS = 50;
const EVENT = "vigla:trip-history-changed";

function keyFor(userId: string) {
  return `vigla:trips:${userId}`;
}

export function loadTrips(userId: string): SavedTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTrip[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.id === "string")
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

function persist(userId: string, trips: SavedTrip[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(trips.slice(0, MAX_TRIPS)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore quota errors */
  }
}

export function saveTrip(userId: string, trip: Omit<SavedTrip, "id" | "timestamp">) {
  const trips = loadTrips(userId);
  const last = trips[0];
  // Avoid duplicating the same destination within a minute (recalculations).
  if (
    last &&
    Math.abs(last.endLat - trip.endLat) < 1e-5 &&
    Math.abs(last.endLng - trip.endLng) < 1e-5 &&
    Date.now() - last.timestamp < 60_000
  ) {
    return;
  }
  const next: SavedTrip = {
    ...trip,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  persist(userId, [next, ...trips]);
}

export function deleteTrip(userId: string, id: string) {
  persist(
    userId,
    loadTrips(userId).filter((t) => t.id !== id),
  );
}

export function clearTrips(userId: string) {
  persist(userId, []);
}

export function subscribeTrips(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function formatTripDate(ts: number, lang: string): string {
  const d = new Date(ts);
  const now = new Date();
  const isFr = lang.startsWith("fr");
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString(isFr ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay(d, now)) return `${isFr ? "Aujourd'hui" : "Today"} ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `${isFr ? "Hier" : "Yesterday"} ${time}`;
  return d.toLocaleDateString(isFr ? "fr-FR" : "en-US", { day: "numeric", month: "short" });
}

export function formatTripDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatTripDuration(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
