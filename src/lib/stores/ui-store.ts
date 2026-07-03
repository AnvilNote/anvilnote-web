"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type UiState = {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  mobilePanelOpen: boolean;
  setMobilePanelOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
  mobilePanelOpen: false,
  setMobilePanelOpen: (open) => set({ mobilePanelOpen: open }),
}));

const RIGHT_PANEL_TAB_STORAGE_KEY = "anvilnote.right-panel-tab";

type RightPanelTabState = {
  tab: string;
  setTab: (tab: string) => void;
};

// Persisted separately from useUiStore above: commandOpen/mobilePanelOpen
// are transient and should always reset on reload, but which right-panel
// tab (Outline/Info/Template/Export/History) was last open is a genuine
// preference — reloading, switching locale, or reopening a document
// shouldn't silently reset it back to Outline.
export const useRightPanelTabStore = create<RightPanelTabState>()(
  persist(
    (set) => ({
      tab: "outline",
      setTab: (tab) => set({ tab }),
    }),
    {
      name: RIGHT_PANEL_TAB_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
