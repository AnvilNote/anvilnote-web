"use client";

import { create } from "zustand";

// Tracks how many times the "@" cross-reference suggestion popup has
// opened. The tour uses this to detect "the user actually tried @" without
// coupling CrossRefSuggestion's factory signature to tour state — mirrors
// slash-menu-store.ts exactly, same reasoning, separate store since the two
// popups open independently of each other.
type CrossRefMenuState = {
  openCount: number;
  markOpened: () => void;
};

export const useCrossRefMenuStore = create<CrossRefMenuState>((set) => ({
  openCount: 0,
  markOpened: () => set((s) => ({ openCount: s.openCount + 1 })),
}));
