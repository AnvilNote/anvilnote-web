import { create } from "zustand";
import type { ChangelogEntry } from "@/lib/changelog/parse";

// No persist middleware -- unlike most stores here, this one is re-hydrated
// fresh from the server on every layout render (ChangelogHydrator), not from
// localStorage, so there's nothing worth persisting across sessions; the
// source of truth is the locale's own markdown file, not client state.
type ChangelogState = {
  entries: ChangelogEntry[];
  setEntries: (entries: ChangelogEntry[]) => void;
};

export const useChangelogStore = create<ChangelogState>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
}));
