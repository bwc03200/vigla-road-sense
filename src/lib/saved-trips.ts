import { supabase } from "@/integrations/supabase/client";

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
  const { error } = await supabase.from("saved_trips").delete().eq("id", id);
  if (error) {
    console.log("🔴 [TRIP DELETE FAILED]", error.message);
    return false;
  }
  console.log("🟢 [TRIP DELETED]", id);
  return true;
}
