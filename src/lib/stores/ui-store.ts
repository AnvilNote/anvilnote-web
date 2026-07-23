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

export type SettingsCategoryId =
  | "appearance"
  | "language"
  | "ai"
  | "documentDefaults"
  | "versionHistory"
  | "export"
  | "backup"
  | "update";

type SettingsDialogState = {
  open: boolean;
  category: SettingsCategoryId;
  // `category` param is optional so callers that don't care which panel is
  // showing (most of them) don't have to think about it; opening always
  // jumps to a specific panel rather than remembering the last one, since
  // e.g. the "AI not configured" prompt in smart-mode-panel always wants
  // the AI panel regardless of what was open last time.
  openSettings: (category?: SettingsCategoryId) => void;
  closeSettings: () => void;
  setSettingsCategory: (category: SettingsCategoryId) => void;
};

export const useSettingsDialogStore = create<SettingsDialogState>((set) => ({
  open: false,
  category: "appearance",
  openSettings: (category) =>
    set((s) => ({ open: true, category: category ?? s.category })),
  closeSettings: () => set({ open: false }),
  setSettingsCategory: (category) => set({ category }),
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

const LAST_ROUTE_STORAGE_KEY = "anvilnote.last-route";

type LastRouteState = {
  path: string | null;
  setPath: (path: string) => void;
};

// Desktop always cold-boots at a fixed "/documents" URL (see
// anvilnote-desktop/src/main/main.ts) instead of remembering where the
// window was left, unlike a browser tab. AppShell records the current
// route here on every navigation and, on that fixed boot route, replaces
// it with whatever was last recorded — so quitting mid-document and
// reopening lands back on that document instead of the documents list.
export const useLastRouteStore = create<LastRouteState>()(
  persist(
    (set) => ({
      path: null,
      setPath: (path) => set({ path }),
    }),
    {
      name: LAST_ROUTE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
