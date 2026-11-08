import { supabase } from "@/integrations/supabase/client";
import { GUEST_USER_ID, isGuestUser, readGuestData, writeGuestData } from "./access-mode";
import { loadTrips, deleteTrip } from "./trip-history";

export interface SavedTripRow {
  id: string;
  user_id: string;
  start_name: string;
  start_lat: number;
  start_lng: number;
  end_name: string;
  end_lat: number;
  end_lng: number;
  waypoints: { name: string; lat: number; lon: number }[];
  distance_m: number;
  duration_s: number;
  is_favorite: boolean;
  created_at: string;
}

export interface NewSavedTrip {
  startName: string;
  startLat: number;
  startLng: number;
  endName: string;
  endLat: number;
  endLng: number;
  waypoints: { name: string; lat: number; lon: number }[];
  distanceM: number;
  durationS: number;
}

export async function listSavedTrips(userId: string): Promise<SavedTripRow[]> {
  if (isGuestUser(userId)) {
    const completed = readGuestData<SavedTripRow[]>("saved-trips", []);
    const favorites = readGuestData<Record<string, boolean>>("trip-favorites", {});
    const local = loadTrips(userId).map((trip): SavedTripRow => ({
      id: `guest-trip-${trip.id}`, user_id: userId,
      start_name: trip.startName, start_lat: trip.startLat, start_lng: trip.startLng,
      end_name: trip.endName, end_lat: trip.endLat, end_lng: trip.endLng,
      waypoints: [], distance_m: trip.distanceM, duration_s: trip.durationS,
      is_favorite: false, created_at: new Date(trip.timestamp).toISOString(),
    }));
    return [...completed, ...local.filter(trip => !completed.some(row => row.end_lat === trip.end_lat && row.end_lng === trip.end_lng))]
      .map(trip => ({ ...trip, is_favorite: favorites[trip.id] ?? trip.is_favorite }))
      .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || Date.parse(b.created_at) - Date.parse(a.created_at));
  }
  const { data, error } = await supabase
    .from("saved_trips")
    .select("*")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.log("🔴 [TRIP HISTORY LOAD ERROR]", error.message);
    return [];
  }
  return (data ?? []) as unknown as SavedTripRow[];
}

export async function insertSavedTrip(userId: string, trip: NewSavedTrip) {
  if (isGuestUser(userId)) {
    const row: SavedTripRow = {
      id: `guest-saved-${crypto.randomUUID()}`, user_id: userId,
      start_name: trip.startName, start_lat: trip.startLat, start_lng: trip.startLng,
      end_name: trip.endName, end_lat: trip.endLat, end_lng: trip.endLng,
      waypoints: trip.waypoints, distance_m: trip.distanceM, duration_s: trip.durationS,
      is_favorite: false, created_at: new Date().toISOString(),
    };
    writeGuestData("saved-trips", [row, ...readGuestData<SavedTripRow[]>("saved-trips", [])].slice(0, 50));
    return true;
  }
  console.log("🟢 [TRIP RECORDED:", `${trip.startName} → ${trip.endName}]`);
  const { error } = await supabase.from("saved_trips").insert({
    user_id: userId,
    start_name: trip.startName,
    start_lat: trip.startLat,
    start_lng: trip.startLng,
    end_name: trip.endName,
    end_lat: trip.endLat,
    end_lng: trip.endLng,
    waypoints: trip.waypoints,
    distance_m: trip.distanceM,
    duration_s: trip.durationS,
  });
  if (error) {
    console.log("🔴 [DB INSERT FAILED]", error.message);
    return false;
  }
  console.log("🟢 [DB INSERT: Supabase]");
  return true;
}

export async function toggleSavedTripFavorite(id: string, next: boolean) {
  if (id.startsWith("guest-")) {
    writeGuestData("trip-favorites", { ...readGuestData("trip-favorites", {}), [id]: next });
    return true;
  }
  const { error } = await supabase
    .from("saved_trips")
    .update({ is_favorite: next })
    .eq("id", id);
  if (error) {
    console.log("🔴 [FAVORITE TOGGLE FAILED]", error.message);
    return false;
  }
  console.log("🟢 [FAVORITE TOGGLED]", next ? "on" : "off");
  return true;
}

export async function deleteSavedTrip(id: string) {
  if (id.startsWith("guest-")) {
    const rows = readGuestData<SavedTripRow[]>("saved-trips", []);
    const row = rows.find(trip => trip.id === id);
    for (const trip of loadTrips(GUEST_USER_ID)) {
      if (id === `guest-trip-${trip.id}` || (row && row.end_lat === trip.endLat && row.end_lng === trip.endLng)) deleteTrip(GUEST_USER_ID, trip.id);
    }
    writeGuestData("saved-trips", rows.filter(trip => trip.id !== id));
    return true;
  }
  const { error } = await supabase.from("saved_trips").delete().eq("id", id);
  if (error) {
    console.log("🔴 [TRIP DELETE FAILED]", error.message);
    return false;
  }
  console.log("🟢 [TRIP DELETED]", id);
  return true;
}
