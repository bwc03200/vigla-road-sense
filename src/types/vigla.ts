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

export const HAZARD_LABELS: Record<HazardType, string> = {
  radar_fixe: "Radar fixe",
  radar_mobile: "Radar mobile",
  accident: "Accident",
  travaux: "Travaux",
  obstacle: "Obstacle",
  ralentissement: "Ralentissement",
};
