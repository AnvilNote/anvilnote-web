import { create } from "zustand";
import { compareVersions, fetchLatestReleaseVersion } from "@/lib/update-check";
import { applyDesktopUpdateStatus, type DesktopUpdateState } from "@/lib/desktop-update";

type UpdateState = {
  checked: boolean;
  latestVersion: string | null;
  checkForUpdate: () => Promise<void>;
} & DesktopUpdateState & {
    // Wires window.anvilnote.update.onStatus exactly once and kicks off the
    // first check. Safe to call from multiple mounted components — only the
    // first call subscribes; returns the unsubscribe function either way.
    subscribeDesktopUpdates: () => () => void;
    downloadDesktopUpdate: () => Promise<void>;
    installDesktopUpdate: () => Promise<void>;
  };

let desktopUnsubscribe: (() => void) | null = null;

export const useUpdateStore = create<UpdateState>((set, get) => ({
  checked: false,
  latestVersion: null,
  phase: "idle",
  version: null,
  downloadPercent: 0,
  errorMessage: null,
  checkForUpdate: async () => {
    if (get().checked) return;
    set({ checked: true });
    const latestVersion = await fetchLatestReleaseVersion();
    set({ latestVersion });
  },
  subscribeDesktopUpdates: () => {
    const bridge = typeof window !== "undefined" ? window.anvilnote?.update : undefined;
    if (!bridge) return () => {};
    if (!desktopUnsubscribe) {
      desktopUnsubscribe = bridge.onStatus((status) => set((prev) => applyDesktopUpdateStatus(prev, status)));
      void bridge.check();
    }
    return () => {
      desktopUnsubscribe?.();
      desktopUnsubscribe = null;
    };
  },
  downloadDesktopUpdate: async () => {
    await window.anvilnote?.update?.download();
  },
  installDesktopUpdate: async () => {
    await window.anvilnote?.update?.install();
  },
}));

export function selectHasUpdate(currentVersion: string) {
  return (state: UpdateState) =>
    (state.latestVersion !== null && compareVersions(state.latestVersion, currentVersion) > 0) ||
    state.phase === "available" ||
    state.phase === "downloading" ||
    state.phase === "downloaded";
}
