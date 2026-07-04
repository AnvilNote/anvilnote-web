"use client";

import { create } from "zustand";

const STORAGE_KEY = "anvilnote.tour.done";

// "history" (Version History) counts toward the panel step's own
// visited-tabs progress ("已看 N/5") rather than getting a separate tour
// step — it lives in the same right-panel tab strip as the other four, so
// folding it in there instead of a standalone step avoids sending the user
// back and forth between two steps that spotlight the same element.
export const TOUR_TAB_IDS = ["outline", "metadata", "template", "export", "history"] as const;

export type TourStepId =
  | "sidebar"
  | "newDoc"
  | "toolbar"
  | "slash"
  | "mathInline"
  | "mathBlock"
  | "footnote"
  | "crossRef"
  | "imageCrop"
  | "panel";

export type TourStep = {
  id: TourStepId;
  /** CSS selector for the element to spotlight. */
  anchor: string;
  /** Step requires the user to perform the action; the Next button is gated. */
  forced?: boolean;
};

export const TOUR_STEPS: TourStep[] = [
  { id: "sidebar", anchor: '[data-tour="sidebar-toggle"]' },
  { id: "newDoc", anchor: '[data-tour="new-doc"]', forced: true },
  { id: "toolbar", anchor: '[data-tour="toolbar"]' },
  { id: "slash", anchor: '[data-tour="editor-area"]', forced: true },
  { id: "mathInline", anchor: '[data-tour="editor-area"]', forced: true },
  { id: "mathBlock", anchor: '[data-tour="editor-area"]', forced: true },
  { id: "footnote", anchor: '[data-tour="editor-area"]', forced: true },
  { id: "crossRef", anchor: '[data-tour="editor-area"]', forced: true },
  // Not forced: unlike the other input-shortcut steps, trying this out
  // requires an image already sitting in the document, which the tour has
  // no way to guarantee at this point — so it's shown as a plain tip
  // instead of gating Next on the user actually cropping something.
  { id: "imageCrop", anchor: '[data-tour="editor-area"]' },
  { id: "panel", anchor: '[data-tour="right-tabs"]', forced: true },
];

type TourState = {
  active: boolean;
  stepIndex: number;
  visitedTabs: string[];
  start: () => void;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
  finish: () => void;
  skip: () => void;
  markTabVisited: (id: string) => void;
};

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore (private mode / disabled storage)
  }
}

export const useTourStore = create<TourState>((set) => ({
  active: false,
  stepIndex: 0,
  visitedTabs: [],
  start: () => set({ active: true, stepIndex: 0, visitedTabs: [] }),
  next: () =>
    set((s) => ({ stepIndex: Math.min(TOUR_STEPS.length - 1, s.stepIndex + 1) })),
  back: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  goTo: (index) => set({ stepIndex: index }),
  finish: () => {
    markSeen();
    set({ active: false });
  },
  skip: () => {
    markSeen();
    set({ active: false });
  },
  markTabVisited: (id) =>
    set((s) => (s.visitedTabs.includes(id) ? s : { visitedTabs: [...s.visitedTabs, id] })),
}));
