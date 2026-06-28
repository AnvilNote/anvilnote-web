"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";

const STORAGE_KEY = "anvilnote.settings";

type SettingsState = {
  autosave: boolean;
  spellcheck: boolean;
  exportPageSize: ExportPageSize;
  exportFontPreset: ExportFontPreset;
  exportIncludeMetadata: boolean;
  setAutosave: (v: boolean) => void;
  setSpellcheck: (v: boolean) => void;
  setExportPageSize: (v: ExportPageSize) => void;
  setExportFontPreset: (v: ExportFontPreset) => void;
  setExportIncludeMetadata: (v: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autosave: true,
      spellcheck: true,
      exportPageSize: "A4",
      exportFontPreset: "serif",
      exportIncludeMetadata: true,
      setAutosave: (v) => set({ autosave: v }),
      setSpellcheck: (v) => set({ spellcheck: v }),
      setExportPageSize: (v) => set({ exportPageSize: v }),
      setExportFontPreset: (v) => set({ exportFontPreset: v }),
      setExportIncludeMetadata: (v) => set({ exportIncludeMetadata: v }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
