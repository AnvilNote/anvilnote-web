"use client";

import { create } from "zustand";

// Tracks how many times the "/" suggestion popup has opened. The tour uses
// this to detect "the user actually tried the slash command" without coupling
// createSlashCommand's factory signature to tour state.
type SlashMenuState = {
  openCount: number;
  markOpened: () => void;
};

export const useSlashMenuStore = create<SlashMenuState>((set) => ({
  openCount: 0,
  markOpened: () => set((s) => ({ openCount: s.openCount + 1 })),
}));
