"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";
import { DEFAULT_DATE_FORMAT, type DateFormat } from "@/lib/date-format";
import type { WritingStyle } from "@anvilnote/ai-writer/contracts";

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
  // Display format for every "date"-type metadata field, app-wide — not
  // per-document/per-field. Applied both in the metadata panel's picker
  // button and to the value actually sent to the renderer/exported PDF
  // (see export.ts); the underlying stored value stays a plain "YYYY-MM-DD"
  // string regardless, so switching formats is always lossless.
  dateFormat: DateFormat;
  // Floating "?" tutorial/help button, bottom-right of the app shell
  // (see tour-replay-button.tsx). Persisted so a user who dismisses it
  // doesn't see it reappear on reload; re-enabled from Settings.
  hideTourButton: boolean;
  // User-dragged position for the same floating button, in px offsets from
  // the viewport's bottom-right corner. null means "use the default corner
  // position" (never dragged, or reset).
  tourButtonPosition: { right: number; bottom: number } | null;
  aiProviderId: "openai";
  aiModelId: string;
  aiHumanizerEnabled: boolean;
  aiWritingStyle: WritingStyle;
  setAutosave: (v: boolean) => void;
  setSpellcheck: (v: boolean) => void;
  setExportPageSize: (v: ExportPageSize) => void;
  setExportFontPreset: (v: ExportFontPreset) => void;
  setExportStorageLocation: (v: string) => void;
  setVersionSnapshotIntervalMinutes: (v: VersionSnapshotIntervalMinutes) => void;
  setDefaultAuthor: (v: string) => void;
  setDateFormat: (v: DateFormat) => void;
  setHideTourButton: (v: boolean) => void;
  setTourButtonPosition: (v: { right: number; bottom: number } | null) => void;
  setAIModelId: (v: string) => void;
  setAIHumanizerEnabled: (v: boolean) => void;
  setAIWritingStyle: (v: WritingStyle) => void;
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
      dateFormat: DEFAULT_DATE_FORMAT,
      hideTourButton: false,
      tourButtonPosition: null,
      aiProviderId: "openai",
      aiModelId: "gpt-5.6-terra",
      aiHumanizerEnabled: true,
      aiWritingStyle: "auto",
      setAutosave: (v) => set({ autosave: v }),
      setSpellcheck: (v) => set({ spellcheck: v }),
      setExportPageSize: (v) => set({ exportPageSize: v }),
      setExportFontPreset: (v) => set({ exportFontPreset: v }),
      setExportStorageLocation: (v) => set({ exportStorageLocation: v }),
      setVersionSnapshotIntervalMinutes: (v) => set({ versionSnapshotIntervalMinutes: v }),
      setDefaultAuthor: (v) => set({ defaultAuthor: v }),
      setDateFormat: (v) => set({ dateFormat: v }),
      setHideTourButton: (v) => set({ hideTourButton: v }),
      setTourButtonPosition: (v) => set({ tourButtonPosition: v }),
      setAIModelId: (v) => set({ aiModelId: v }),
      setAIHumanizerEnabled: (v) => set({ aiHumanizerEnabled: v }),
      setAIWritingStyle: (v) => set({ aiWritingStyle: v }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
