"use client";

import { create } from "zustand";

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
