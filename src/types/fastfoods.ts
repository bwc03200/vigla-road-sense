/** Shared FastFood POI types (client-safe, mirrors fastfoods.server.ts). */
export type FastfoodBrand =
  | "mcdonalds"
  | "kfc"
  | "burger_king"
  | "subway"
  | "quick";

export interface FastfoodPOI {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  brand: FastfoodBrand;
  amenity: string;
}

export const BRAND_COLORS: Record<FastfoodBrand, string> = {
  mcdonalds: "#DA291C",
  kfc: "#8B0000",
  burger_king: "#FF6B35",
  subway: "#2E7D32",
  quick: "#7C3AED",
};

export const BRAND_ICONS: Record<FastfoodBrand, string> = {
  mcdonalds: "🍔",
  kfc: "🍗",
  burger_king: "🍔",
  subway: "🌯",
  quick: "🍟",
};
