"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";
import { DEFAULT_DATE_FORMAT, type DateFormat } from "@/lib/date-format";
import type { WritingStyle } from "@anvilnote/ai-writer/contracts";
import type { OrderedModuleId, UnorderedSymbol } from "@/lib/list-markers/marker-modules";

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

// Default 5-level cycle for each list type, applied at nesting depth 1-5
// (depth 6+ wraps back to level 1 — see list-markers.ts). Chosen to stay
// close to the app's previous hardcoded defaults while fitting entirely
// within the new module/symbol catalog (marker-modules.ts).
const DEFAULT_ORDERED_LIST_LEVELS: OrderedModuleId[] = [
  "arabic",
  "paren-arabic",
  "circled",
  "alpha-lower",
  "roman-lower",
];
const DEFAULT_UNORDERED_LIST_LEVELS: UnorderedSymbol[] = ["•", "◦", "▪", "–", "■"];

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
  // The loading-transition shower (falling icons) only ever appears during
  // an actual holiday window (see src/lib/holidays) — this just lets someone
  // who finds it distracting turn it off. Doesn't affect the sidebar hat.
  holidayEffectsEnabled: boolean;
  // User-dragged position for the same floating button, in px offsets from
  // the viewport's bottom-right corner. null means "use the default corner
  // position" (never dragged, or reset).
  tourButtonPosition: { right: number; bottom: number } | null;
  aiProviderId: "openai";
  aiModelId: string;
  aiHumanizerEnabled: boolean;
  aiWritingStyle: WritingStyle;
  // Ordered/unordered list-marker level cycles, in nesting-depth order
  // (index 0 = depth 1). User-editable length (add/remove a level) — see
  // the CRUD setters below. Consumed by list-markers.ts (live editor) and
  // threaded through ExportOptions into the Typst render pipeline so the
  // exported PDF matches what's shown on screen.
  orderedListLevels: OrderedModuleId[];
  unorderedListLevels: UnorderedSymbol[];
  setAutosave: (v: boolean) => void;
  setSpellcheck: (v: boolean) => void;
  setExportPageSize: (v: ExportPageSize) => void;
  setExportFontPreset: (v: ExportFontPreset) => void;
  setExportStorageLocation: (v: string) => void;
  setVersionSnapshotIntervalMinutes: (v: VersionSnapshotIntervalMinutes) => void;
  setDefaultAuthor: (v: string) => void;
  setDateFormat: (v: DateFormat) => void;
  setHideTourButton: (v: boolean) => void;
  setHolidayEffectsEnabled: (v: boolean) => void;
  setTourButtonPosition: (v: { right: number; bottom: number } | null) => void;
  setAIModelId: (v: string) => void;
  setAIHumanizerEnabled: (v: boolean) => void;
  setAIWritingStyle: (v: WritingStyle) => void;
  setOrderedListLevel: (index: number, moduleId: OrderedModuleId) => void;
  addOrderedListLevel: (moduleId: OrderedModuleId) => void;
  removeOrderedListLevel: (index: number) => void;
  setUnorderedListLevel: (index: number, symbol: UnorderedSymbol) => void;
  addUnorderedListLevel: (symbol: UnorderedSymbol) => void;
  removeUnorderedListLevel: (index: number) => void;
  resetOrderedListLevels: () => void;
  resetUnorderedListLevels: () => void;
  resetAllSettings: () => void;
};

// Shared by the store's initial state AND resetAllSettings() below, so the
// two can never drift apart (e.g. someone adding a new setting to one but
// forgetting the other).
const DEFAULT_SETTINGS: Omit<
  SettingsState,
  // every function-valued key
  | "setAutosave"
  | "setSpellcheck"
  | "setExportPageSize"
  | "setExportFontPreset"
  | "setExportStorageLocation"
  | "setVersionSnapshotIntervalMinutes"
  | "setDefaultAuthor"
  | "setDateFormat"
  | "setHideTourButton"
  | "setHolidayEffectsEnabled"
  | "setTourButtonPosition"
  | "setAIModelId"
  | "setAIHumanizerEnabled"
  | "setAIWritingStyle"
  | "setOrderedListLevel"
  | "addOrderedListLevel"
  | "removeOrderedListLevel"
  | "setUnorderedListLevel"
  | "addUnorderedListLevel"
  | "removeUnorderedListLevel"
  | "resetOrderedListLevels"
  | "resetUnorderedListLevels"
  | "resetAllSettings"
> = {
  autosave: true,
  spellcheck: true,
  exportPageSize: "A4",
  exportFontPreset: "serif",
  exportStorageLocation: DEFAULT_STORAGE_LOCATION,
  versionSnapshotIntervalMinutes: 15,
  defaultAuthor: "",
  dateFormat: DEFAULT_DATE_FORMAT,
  hideTourButton: false,
  holidayEffectsEnabled: true,
  tourButtonPosition: null,
  aiProviderId: "openai",
  aiModelId: "gpt-5.6-terra",
  aiHumanizerEnabled: true,
  aiWritingStyle: "auto",
  orderedListLevels: DEFAULT_ORDERED_LIST_LEVELS,
  unorderedListLevels: DEFAULT_UNORDERED_LIST_LEVELS,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setAutosave: (v) => set({ autosave: v }),
      setSpellcheck: (v) => set({ spellcheck: v }),
      setExportPageSize: (v) => set({ exportPageSize: v }),
      setExportFontPreset: (v) => set({ exportFontPreset: v }),
      setExportStorageLocation: (v) => set({ exportStorageLocation: v }),
      setVersionSnapshotIntervalMinutes: (v) => set({ versionSnapshotIntervalMinutes: v }),
      setDefaultAuthor: (v) => set({ defaultAuthor: v }),
      setDateFormat: (v) => set({ dateFormat: v }),
      setHideTourButton: (v) => set({ hideTourButton: v }),
      setHolidayEffectsEnabled: (v) => set({ holidayEffectsEnabled: v }),
      setTourButtonPosition: (v) => set({ tourButtonPosition: v }),
      setAIModelId: (v) => set({ aiModelId: v }),
      setAIHumanizerEnabled: (v) => set({ aiHumanizerEnabled: v }),
      setAIWritingStyle: (v) => set({ aiWritingStyle: v }),
      setOrderedListLevel: (index, moduleId) =>
        set((state) => ({
          orderedListLevels: state.orderedListLevels.map((existing, i) =>
            i === index ? moduleId : existing,
          ),
        })),
      addOrderedListLevel: (moduleId) =>
        set((state) => ({ orderedListLevels: [...state.orderedListLevels, moduleId] })),
      removeOrderedListLevel: (index) =>
        set((state) => {
          if (state.orderedListLevels.length <= 1) return state;
          return { orderedListLevels: state.orderedListLevels.filter((_, i) => i !== index) };
        }),
      setUnorderedListLevel: (index, symbol) =>
        set((state) => ({
          unorderedListLevels: state.unorderedListLevels.map((existing, i) =>
            i === index ? symbol : existing,
          ),
        })),
      addUnorderedListLevel: (symbol) =>
        set((state) => ({ unorderedListLevels: [...state.unorderedListLevels, symbol] })),
      removeUnorderedListLevel: (index) =>
        set((state) => {
          if (state.unorderedListLevels.length <= 1) return state;
          return { unorderedListLevels: state.unorderedListLevels.filter((_, i) => i !== index) };
        }),
      resetOrderedListLevels: () =>
        set({ orderedListLevels: DEFAULT_ORDERED_LIST_LEVELS }),
      resetUnorderedListLevels: () =>
        set({ unorderedListLevels: DEFAULT_UNORDERED_LIST_LEVELS }),
      resetAllSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
