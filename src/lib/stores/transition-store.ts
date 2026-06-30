"use client";

import { create } from "zustand";

type TransitionState = {
  /** Whether the transition overlay is currently visible. */
  playing: boolean;
  /** Destination href to navigate to when the overlay finishes, or null. */
  to: string | null;
  /** Play the overlay and navigate to `href` partway through. */
  start: (href: string) => void;
  /** Play the overlay without navigating (e.g. on reload of the editor). */
  play: () => void;
  clear: () => void;
};

export const useTransitionStore = create<TransitionState>((set) => ({
  playing: false,
  to: null,
  start: (href) => set({ playing: true, to: href }),
  play: () => set({ playing: true, to: null }),
  clear: () => set({ playing: false, to: null }),
}));
