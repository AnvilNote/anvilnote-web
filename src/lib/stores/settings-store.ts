"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";

const STORAGE_KEY = "anvilnote.settings";

// Browsers can't read the OS download path, so default to the conventional
// "Downloads" folder name.
const DEFAULT_STORAGE_LOCATION = "Downloads";

// Minutes between automatic version-history snapshots; 0 disables the
// feature entirely. A closed preset list (not a free-form number input) so
// nobody accidentally sets something like 1 second and floods the version
// table — see version-history-panel.tsx / document-store.ts for where this
// is actually consumed.
export const VERSION_SNAPSHOT_INTERVAL_OPTIONS = [0, 5, 15, 30, 60] as const;
export type VersionSnapshotIntervalMinutes = (typeof VERSION_SNAPSHOT_INTERVAL_OPTIONS)[number];

type SettingsState = {
  autosave: boolean;
  spellcheck: boolean;
  exportPageSize: ExportPageSize;
  exportFontPreset: ExportFontPreset;
  exportStorageLocation: string;
  versionSnapshotIntervalMinutes: VersionSnapshotIntervalMinutes;
  // Auto-filled into a new document's `author` metadata field (only for
  // templates that expose one — see document-store.ts's createDocument,
  // same "seed if the field exists" pattern already used for `title`).
  // Editable per-document afterwards; this only supplies the starting
  // value, never overwrites an already-saved document.
  defaultAuthor: string;
  setAutosave: (v: boolean) => void;
  setSpellcheck: (v: boolean) => void;
  setExportPageSize: (v: ExportPageSize) => void;
  setExportFontPreset: (v: ExportFontPreset) => void;
  setExportStorageLocation: (v: string) => void;
  setVersionSnapshotIntervalMinutes: (v: VersionSnapshotIntervalMinutes) => void;
  setDefaultAuthor: (v: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autosave: true,
      spellcheck: true,
      exportPageSize: "A4",
      exportFontPreset: "serif",
      exportStorageLocation: DEFAULT_STORAGE_LOCATION,
      versionSnapshotIntervalMinutes: 15,
      defaultAuthor: "",
      setAutosave: (v) => set({ autosave: v }),
      setSpellcheck: (v) => set({ spellcheck: v }),
      setExportPageSize: (v) => set({ exportPageSize: v }),
      setExportFontPreset: (v) => set({ exportFontPreset: v }),
      setExportStorageLocation: (v) => set({ exportStorageLocation: v }),
      setVersionSnapshotIntervalMinutes: (v) => set({ versionSnapshotIntervalMinutes: v }),
      setDefaultAuthor: (v) => set({ defaultAuthor: v }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
