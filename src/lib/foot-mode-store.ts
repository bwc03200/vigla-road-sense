import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FootModeState {
  isFootMode: boolean;
  toggleFootMode: () => void;
  setFootMode: (v: boolean) => void;
}

export const useFootModeStore = create<FootModeState>()(
  persist(
    (set) => ({
      isFootMode: false,
      toggleFootMode: () => set((s) => ({ isFootMode: !s.isFootMode })),
      setFootMode: (v) => set({ isFootMode: v }),
    }),
    {
      name: "vigla:footMode",
    }
  )
);
