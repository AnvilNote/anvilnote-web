import { create } from "zustand";

interface SmartModeUIState {
  open: boolean;
  setOpen(open: boolean): void;
}

/**
 * Ephemeral UI coordination only. This store is intentionally not persisted:
 * it lets floating controls avoid an open Smart Mode sheet without coupling
 * Smart Mode to the Tour's saved visibility or drag position.
 */
export const useSmartModeUIStore = create<SmartModeUIState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
