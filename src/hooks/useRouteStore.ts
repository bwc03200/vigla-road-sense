import { create } from "zustand";
import { useVigla } from "@/lib/vigla-store";
import { buildRouteState, fetchOsrmRouteVia } from "@/lib/routing";
import type { RouteState as ViglaRouteState, RouteWaypoint } from "@/types/vigla";

/**
 * P8-Ph1 — Single source of truth for routing.
 *
 * The app already stores the computed route inside the main Vigla store
 * (`useVigla().route`), which every map/navigation component reads. Rather
 * than duplicating that state (and desynchronising the map), this store is a
 * thin, centralised facade over it: it exposes start/end inputs, the OSRM
 * output (polyline, distance, duration, instructions), the UI state
 * (isCalculating, error) and the actions, and it mirrors the Vigla route both
 * ways. It also persists the last route to localStorage so it survives a
 * refresh.
 */

const LS_KEY = "vigla-route-store";

export interface OSRMInstruction {
  text: string;
  distance: number;
  duration: number;
  direction?: string;
}

export interface RouteStoreState {
  // Input
  startName: string | null;
  startCoords: [number, number] | null;
  endName: string | null;
  endCoords: [number, number] | null;

  // Output
  distance: number | null;
  duration: number | null;
  polyline: [number, number][] | null;
  instructions: OSRMInstruction[] | null;

  // UI
  isCalculating: boolean;
  error: string | null;

  // Actions
  setStart: (name: string, coords: [number, number]) => void;
  setEnd: (name: string, coords: [number, number]) => void;
  calculateRoute: () => Promise<void>;
  clearRoute: () => void;
  setInstructions: (instructions: OSRMInstruction[]) => void;
  setError: (error: string | null) => void;
}

interface PersistedShape {
  startName: string | null;
  startCoords: [number, number] | null;
  endName: string | null;
  endCoords: [number, number] | null;
  distance: number | null;
  duration: number | null;
  polyline: [number, number][] | null;
  instructions: OSRMInstruction[] | null;
  route: ViglaRouteState | null;
}

function loadPersisted(): PersistedShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return null;
  }
}

function persist(state: RouteStoreState, route: ViglaRouteState | null) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedShape = {
      startName: state.startName,
      startCoords: state.startCoords,
      endName: state.endName,
      endCoords: state.endCoords,
      distance: state.distance,
      duration: state.duration,
      polyline: state.polyline,
      instructions: state.instructions,
      route,
    };
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — non fatal */
  }
}

function instructionsFromRoute(route: ViglaRouteState): OSRMInstruction[] {
  return route.steps.map((s) => ({
    text: s.instruction,
    distance: s.distanceMeters,
    duration: 0,
    direction: s.maneuverType,
  }));
}

const persisted = loadPersisted();

export const useRouteStore = create<RouteStoreState>()((set, get) => ({
  startName: persisted?.startName ?? null,
  startCoords: persisted?.startCoords ?? null,
  endName: persisted?.endName ?? null,
  endCoords: persisted?.endCoords ?? null,
  distance: persisted?.distance ?? null,
  duration: persisted?.duration ?? null,
  polyline: persisted?.polyline ?? null,
  instructions: persisted?.instructions ?? null,
  isCalculating: false,
  error: null,

  setStart: (name, coords) => {
    set({ startName: name, startCoords: coords });
    persist(get(), useVigla.getState().route);
  },

  setEnd: (name, coords) => {
    set({ endName: name, endCoords: coords });
    persist(get(), useVigla.getState().route);
  },

  calculateRoute: async () => {
    const { endCoords, endName } = get();
    const vigla = useVigla.getState();
    const startCoords =
      get().startCoords ??
      (vigla.position ? ([vigla.position.lat, vigla.position.lng] as [number, number]) : null);

    if (!startCoords || !endCoords) {
      set({ error: "Start and end coordinates required", isCalculating: false });
      return;
    }

    set({ isCalculating: true, error: null });
    try {
      const result = await fetchOsrmRouteVia([startCoords, endCoords]);
      const destination = {
        lat: endCoords[0],
        lng: endCoords[1],
        label: endName ?? "Destination",
      };
      const waypoints: RouteWaypoint[] = [
        {
          id: `destination-${Date.now()}`,
          type: "destination",
          name: destination.label,
          lat: destination.lat,
          lon: destination.lng,
        },
      ];
      const route = buildRouteState(destination, result, vigla.hazards, waypoints);
      // Keep the map / navigation engine in sync — they read useVigla().route.
      useVigla.getState().setRoute(route);
      set({
        startCoords,
        polyline: route.coords,
        distance: Math.round(route.distanceM),
        duration: Math.round(route.durationS),
        instructions: instructionsFromRoute(route),
        isCalculating: false,
        error: null,
      });
      persist(get(), route);
    } catch (err) {
      set({
        isCalculating: false,
        error: err instanceof Error ? err.message : "Route calculation failed",
        polyline: null,
        distance: null,
        duration: null,
        instructions: null,
      });
      persist(get(), null);
    }
  },

  clearRoute: () => {
    set({
      startName: null,
      startCoords: null,
      endName: null,
      endCoords: null,
      distance: null,
      duration: null,
      polyline: null,
      instructions: null,
      error: null,
      isCalculating: false,
    });
    useVigla.getState().setRoute(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
    }
  },

  setInstructions: (instructions) => {
    set({ instructions });
    persist(get(), useVigla.getState().route);
  },

  setError: (error) => set({ error }),
}));

/**
 * Bridge: any route computed elsewhere (POI "Y aller", address search,
 * roadbooks, navigation recalculation…) flows into this store, and the last
 * route is restored on startup.
 */
let bridged = false;
export function initRouteStoreBridge() {
  if (bridged || typeof window === "undefined") return;
  bridged = true;

  // Restore the persisted route into the map store when nothing is active.
  const saved = loadPersisted();
  if (saved?.route && !useVigla.getState().route) {
    useVigla.getState().setRoute(saved.route);
  }

  useVigla.subscribe((state, prev) => {
    if (state.route === prev.route) return;
    const route = state.route;
    if (!route) {
      const s = useRouteStore.getState();
      if (s.polyline) {
        useRouteStore.setState({
          polyline: null,
          distance: null,
          duration: null,
          instructions: null,
        });
        persist(useRouteStore.getState(), null);
      }
      return;
    }
    useRouteStore.setState({
      endName: route.destination.label,
      endCoords: [route.destination.lat, route.destination.lng],
      polyline: route.coords,
      distance: Math.round(route.distanceM),
      duration: Math.round(route.durationS),
      instructions: instructionsFromRoute(route),
      isCalculating: false,
      error: null,
    });
    persist(useRouteStore.getState(), route);
  });
}
