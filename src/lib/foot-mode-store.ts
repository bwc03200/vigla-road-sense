import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useVigla } from "@/lib/vigla-store";

interface FootModeState {
  isFootMode: boolean;
  toggleFootMode: () => void;
  setFootMode: (v: boolean) => void;
}

function syncToVigla(v: boolean) {
  try {
    useVigla.getState().setIsFootMode(v);
  } catch {
    // Vigla store may not be initialized during module init in SSR.
  }
}

export const useFootModeStore = create<FootModeState>()(
  persist(
    (set) => ({
      isFootMode: false,
      toggleFootMode: () =>
        set((s) => {
          const next = !s.isFootMode;
          syncToVigla(next);
          return { isFootMode: next };
        }),
      setFootMode: (v) => {
        syncToVigla(v);
        set({ isFootMode: v });
      },
    }),
    {
      name: "vigla:footMode",
    },
  ),
);

// Hydrate the main Vigla store with the persisted foot-mode value on startup.
if (typeof window !== "undefined") {
  const initial = useFootModeStore.getState().isFootMode;
  if (initial) {
    syncToVigla(initial);
  }
}
