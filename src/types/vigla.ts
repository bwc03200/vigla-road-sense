export type HazardType =
  | "radar_fixe"
  | "radar_mobile"
  | "accident"
  | "travaux"
  | "obstacle"
  | "ralentissement";

export interface HazardReport {
  id: string;
  type: HazardType;
  latitude: number;
  longitude: number;
  confidence_score: number;
  reported_by: string;
  confirmed_count: number;
  denied_count: number;
  created_at: string;
  expires_at: string;
}

export interface TripHistory {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  distance_km: number;
  alerts_received: number;
}

export interface OfficialRadar {
  id: string;
  latitude: number;
  longitude: number;
  type: string | null;
  route: string | null;
  vitesse_controlee: number | null;
  date_installation: string | null;
  source: string;
  updated_at: string;
}

export interface RouteState {
  destination: { lat: number; lng: number; label: string };
  coords: [number, number][]; // [lat, lng] polyline points
  distanceM: number;
  durationS: number;
  hazardIds: string[]; // hazard_reports ids within 500m of route
}

export const HAZARD_LABELS: Record<HazardType, string> = {
  radar_fixe: "Radar fixe",
  radar_mobile: "Radar mobile",
  accident: "Accident",
  travaux: "Travaux",
  obstacle: "Obstacle",
  ralentissement: "Ralentissement",
};
