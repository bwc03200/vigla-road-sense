import { useEffect, useRef } from "react";
import { useVigla } from "@/lib/vigla-store";
import i18n, { currentLang, setLanguage } from "@/i18n/i18n";

export type Country = "belgium" | "france" | "other";
export type BeRegion = "flanders" | "wallonia" | "brussels";

/** Rough Belgium bounding box (good enough for language/locale purposes). */
export function detectCountry(lat: number, lng: number): Country {
  if (lat >= 49.5 && lat <= 51.55 && lng >= 2.54 && lng <= 6.41) {
    // Exclude northern France strip below the Belgian border west of ~4°E
    if (lat < 50.75 && lng < 3.2) return "france";
    return "belgium";
  }
  if (lat >= 41.3 && lat <= 51.1 && lng >= -5.2 && lng <= 9.6) return "france";
  return "other";
}

export function detectBelgianRegion(lat: number, lng: number): BeRegion {
  if (Math.abs(lat - 50.846) < 0.06 && Math.abs(lng - 4.357) < 0.1) return "brussels";
  return lat > 50.75 ? "flanders" : "wallonia";
}

const MANUAL_KEY = "vigla:lang:manual";

/** Auto-switch language when entering Flanders (NL) / Wallonia (FR), unless the user chose a language manually. */
export function useBelgiumDetection() {
  const position = useVigla((s) => s.position);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!position) return;
    const country = detectCountry(position.lat, position.lng);
    const region = country === "belgium" ? detectBelgianRegion(position.lat, position.lng) : null;
    const key = `${country}:${region}`;
    if (key === last.current) return;
    last.current = key;
    if (country !== "belgium" || !region) return;
    console.log("🟢 Belgium: geolocation detected", { lat: position.lat, lng: position.lng, country, region });

    let manual = false;
    try { manual = localStorage.getItem(MANUAL_KEY) === "1"; } catch { /* ignore */ }
    if (manual || region === "brussels") return;
    const target = region === "flanders" ? "nl" : "fr";
    if (currentLang() !== target) {
      setLanguage(target);
      console.log("🟢 i18n: locale switched", { locale: target, region });
      void i18n;
    }
  }, [position]);
}

export function markLanguageManual() {
  try { localStorage.setItem(MANUAL_KEY, "1"); } catch { /* ignore */ }
}
