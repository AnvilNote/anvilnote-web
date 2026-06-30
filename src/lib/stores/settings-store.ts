"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";

const STORAGE_KEY = "anvilnote.settings";

// Browsers can't read the OS download path, so default to the conventional
// "Downloads" folder name.
const DEFAULT_STORAGE_LOCATION = "Downloads";

type SettingsState = {
  autosave: boolean;
  spellcheck: boolean;
  exportPageSize: ExportPageSize;
  exportFontPreset: ExportFontPreset;
  exportIncludeMetadata: boolean;
  exportStorageLocation: string;
  setAutosave: (v: boolean) => void;
  setSpellcheck: (v: boolean) => void;
  setExportPageSize: (v: ExportPageSize) => void;
  setExportFontPreset: (v: ExportFontPreset) => void;
  setExportIncludeMetadata: (v: boolean) => void;
  setExportStorageLocation: (v: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autosave: true,
      spellcheck: true,
      exportPageSize: "A4",
      exportFontPreset: "serif",
      exportIncludeMetadata: true,
      exportStorageLocation: DEFAULT_STORAGE_LOCATION,
      setAutosave: (v) => set({ autosave: v }),
      setSpellcheck: (v) => set({ spellcheck: v }),
      setExportPageSize: (v) => set({ exportPageSize: v }),
      setExportFontPreset: (v) => set({ exportFontPreset: v }),
      setExportIncludeMetadata: (v) => set({ exportIncludeMetadata: v }),
      setExportStorageLocation: (v) => set({ exportStorageLocation: v }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
