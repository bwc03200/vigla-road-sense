import { create } from "zustand";
import type { HazardReport } from "@/types/vigla";

export interface Position {
  lat: number;
  lng: number;
  heading: number | null;
  timestamp: number;
}

interface ViglaState {
  position: Position | null;
  speedKmh: number; // smoothed
  hazards: HazardReport[];
  online: boolean;
  alertedIds: Set<string>;
  geoError: string | null;
  setPosition: (p: Position, speedFromApi: number | null) => void;
  setHazards: (h: HazardReport[]) => void;
  upsertHazard: (h: HazardReport) => void;
  removeHazard: (id: string) => void;
  setOnline: (v: boolean) => void;
  markAlerted: (id: string) => void;
  clearAlert: (id: string) => void;
  setGeoError: (e: string | null) => void;
}

// Ring buffer for speed smoothing.
const speedBuffer: number[] = [];
let lastPos: Position | null = null;

export const useVigla = create<ViglaState>((set) => ({
  position: null,
  speedKmh: 0,
  hazards: [],
  online: true,
  alertedIds: new Set<string>(),
  geoError: null,

  setPosition: (p, speedFromApi) => {
    let instant = 0;
    if (speedFromApi != null && !Number.isNaN(speedFromApi) && speedFromApi >= 0) {
      instant = speedFromApi * 3.6; // m/s -> km/h
    } else if (lastPos) {
      const dt = (p.timestamp - lastPos.timestamp) / 1000;
      if (dt > 0.2) {
        const dLat = ((p.lat - lastPos.lat) * Math.PI) / 180;
        const dLng = ((p.lng - lastPos.lng) * Math.PI) / 180;
        const R = 6371000;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lastPos.lat * Math.PI) / 180) *
            Math.cos((p.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(a));
        instant = (d / dt) * 3.6;
      }
    }
    speedBuffer.push(instant);
    if (speedBuffer.length > 3) speedBuffer.shift();
    const smoothed =
      speedBuffer.reduce((s, v) => s + v, 0) / speedBuffer.length;
    lastPos = p;
    set({ position: p, speedKmh: smoothed });
  },

  setHazards: (h) => set({ hazards: h }),
  upsertHazard: (h) =>
    set((s) => {
      const idx = s.hazards.findIndex((x) => x.id === h.id);
      if (idx === -1) return { hazards: [...s.hazards, h] };
      const next = s.hazards.slice();
      next[idx] = h;
      return { hazards: next };
    }),
  removeHazard: (id) =>
    set((s) => ({ hazards: s.hazards.filter((x) => x.id !== id) })),
  setOnline: (v) => set({ online: v }),
  markAlerted: (id) =>
    set((s) => {
      const next = new Set(s.alertedIds);
      next.add(id);
      return { alertedIds: next };
    }),
  clearAlert: (id) =>
    set((s) => {
      const next = new Set(s.alertedIds);
      next.delete(id);
      return { alertedIds: next };
    }),
  setGeoError: (e) => set({ geoError: e }),
}));
