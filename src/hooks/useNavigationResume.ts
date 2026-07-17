import { useEffect, useState } from "react";
import { useVigla } from "@/lib/vigla-store";
import { haversine, distanceToPolyline } from "@/lib/geo";
import type { ActiveNavigation, RouteState } from "@/types/vigla";

const STORAGE_KEY = "vigla:nav:resume";
const MAX_AGE_MS = 30 * 60_000;
const MAX_OFFTRACK_M = 5000;

interface PersistedNav {
  savedAt: number;
  route: RouteState;
  navigation: ActiveNavigation;
}

/** Persists the active navigation to localStorage while it's running. */
export function usePersistActiveNavigation() {
  const navigation = useVigla((s) => s.navigation);
  const route = useVigla((s) => s.route);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigation || !route || navigation.arrived) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const payload: PersistedNav = {
        savedAt: Date.now(),
        route,
        navigation,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota errors */
    }
  }, [navigation, route]);
}

/** Offers to resume a previously interrupted navigation. */
export function useResumePrompt(): {
  candidate: PersistedNav | null;
  resume: () => void;
  dismiss: () => void;
} {
  const [candidate, setCandidate] = useState<PersistedNav | null>(null);
  const position = useVigla((s) => s.position);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only offer once per app load, and only if no nav is currently active.
    if (useVigla.getState().navigation) return;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistedNav;
      if (!parsed?.savedAt || !parsed.route || !parsed.navigation) return;
      if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setCandidate(parsed);
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // If GPS is available and the user is nowhere near the saved route, drop it.
  useEffect(() => {
    if (!candidate || !position) return;
    const dest = candidate.route.destination;
    const coords = candidate.route.coords;
    const dRoute =
      coords && coords.length >= 2
        ? distanceToPolyline(position.lat, position.lng, coords)
        : haversine(position.lat, position.lng, dest.lat, dest.lng);
    if (dRoute > MAX_OFFTRACK_M) {
      dismissInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, position?.lat, position?.lng]);

  function dismissInternal() {
    setCandidate(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function resume() {
    if (!candidate) return;
    const { route, navigation } = candidate;
    useVigla.setState({
      route,
      navigation: { ...navigation, recalculating: false, arrived: false },
    });
    setCandidate(null);
  }

  return { candidate, resume, dismiss: dismissInternal };
}
