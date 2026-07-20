export type HazardType =
  | "radar_fixe"
  | "radar_mobile"
  | "accident"
  | "travaux"
  | "obstacle"
  | "ralentissement"
  | "gravillons"
  | "chute_huile"
  | "animal_sauvage"
  | "chaussee_deformee";

export const MOTO_HAZARD_TYPES: HazardType[] = [
  "gravillons",
  "chute_huile",
  "animal_sauvage",
  "chaussee_deformee",
];

export function isMotoHazardType(t: HazardType): boolean {
  return MOTO_HAZARD_TYPES.includes(t);
}

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

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  maneuverType: string;
  location: [number, number];
}

export interface RouteState {
  destination: { lat: number; lng: number; label: string };
  coords: [number, number][];
  distanceM: number;
  durationS: number;
  hazardIds: string[];
  steps: RouteStep[];
}

export interface ActiveNavigation {
  routeCoords: [number, number][];
  remainingCoords: [number, number][];
  consumedCoords: [number, number][];
  steps: RouteStep[];
  currentStepIndex: number;
  distanceRemainingM: number;
  durationRemainingS: number;
  distanceToNextManeuverM: number;
  offRouteM: number;
  offRouteSince: number | null;
  recalculating: boolean;
  arrived: boolean;
  startedAt: string;
  alertsReceived: number;
  protectionOnly?: boolean;
}

export const HAZARD_LABELS: Record<HazardType, string> = {
  radar_fixe: "Radar fixe",
  radar_mobile: "Radar mobile",
  accident: "Accident",
  travaux: "Travaux",
  obstacle: "Obstacle",
  ralentissement: "Ralentissement",
  gravillons: "Gravillons",
  chute_huile: "Huile / carburant",
  animal_sauvage: "Animal sauvage",
  chaussee_deformee: "Chaussée déformée",
};

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export type CrashState =
  | { status: "idle" }
  | { status: "suspected"; startedAt: number };

export interface Convoy {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  created_at: string;
  ended_at: string | null;
}

export interface ConvoyMember {
  id: string;
  convoy_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  last_lat: number | null;
  last_lng: number | null;
  last_seen: string;
}

export type ConvoyReactionKind = "wait" | "join" | "break" | "fuel" | "message";

export interface ConvoyAlert {
  id: string;
  convoy_id: string;
  user_id: string;
  display_name: string;
  kind: ConvoyReactionKind;
  payload: { text?: string };
  created_at: string;
  expires_at: string;
}

export interface Roadbook {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  duration_days: number | null;
  distance_km: number | null;
  route_geojson: {
    coords?: [number, number][];
    destination?: { lat: number; lng: number; label: string };
  } | null;
  cover_hint: string | null;
  is_public: boolean;
  created_at: string;
}

export interface DiscoverySuggestion {
  id: string;
  title: string;
  region: string;
  distanceKm: number;
  durationMin: number;
  description: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
}

export const REACTION_META: Record<
  ConvoyReactionKind,
  { emoji: string; label: string; text: string }
> = {
  wait: { emoji: "🖐️", label: "Attends-moi", text: "Hé, attends-moi !" },
  join: { emoji: "👋", label: "Je rejoins", text: "J'arrive, je vous rejoins." },
  break: { emoji: "☕", label: "Pause", text: "On fait une pause ?" },
  fuel: { emoji: "⛽", label: "Essence", text: "J'ai besoin d'essence." },
  message: { emoji: "💬", label: "Message", text: "" },
};

export type SpeedUnit = "kmh" | "mph";
export type MapTheme = "light" | "dark";
export type AlertLeadTime = "short" | "normal" | "long";

export interface UserPreferences {
  speed_unit: SpeedUnit;
  map_theme: MapTheme;
  auto_recenter: boolean;
  voice_alerts: boolean;
  sound_alerts: boolean;
  vibration_alerts: boolean;
  alert_lead_time: AlertLeadTime;
  moto_mode: boolean;
}

export type HazardFilterKey = HazardType;

export type HazardFilters = Record<HazardFilterKey, boolean>;

export const HAZARD_FILTER_KEYS: HazardFilterKey[] = [
  "radar_fixe",
  "radar_mobile",
  "accident",
  "travaux",
  "obstacle",
  "ralentissement",
  "gravillons",
  "chute_huile",
  "animal_sauvage",
  "chaussee_deformee",
];

export const DEFAULT_HAZARD_FILTERS: HazardFilters = {
  radar_fixe: true,
  radar_mobile: true,
  accident: true,
  travaux: true,
  obstacle: true,
  ralentissement: true,
  gravillons: true,
  chute_huile: true,
  animal_sauvage: true,
  chaussee_deformee: true,
};




