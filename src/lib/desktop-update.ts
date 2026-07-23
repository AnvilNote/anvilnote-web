// Pure state-reducer for the desktop one-click update flow: turns a status
// payload pushed from the Electron main process (via
// window.anvilnote.update.onStatus, see updater.ts in anvilnote-desktop)
// into the next store state. Kept separate from update-store.ts so it's
// testable without touching zustand or window.anvilnote.

export type DesktopUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export type DesktopUpdateState = {
  phase: DesktopUpdatePhase;
  version: string | null;
  downloadPercent: number;
  errorMessage: string | null;
};

export function applyDesktopUpdateStatus(
  prev: DesktopUpdateState,
  status: unknown,
): DesktopUpdateState {
  if (!status || typeof status !== "object") return prev;
  const s = status as { state?: string; version?: string; percent?: number; message?: string };

  switch (s.state) {
    case "checking":
      return { ...prev, phase: "checking", errorMessage: null };
    case "available":
      return { ...prev, phase: "available", version: s.version ?? null };
    case "not-available":
      return { ...prev, phase: "not-available" };
    case "downloading":
      return { ...prev, phase: "downloading", downloadPercent: s.percent ?? 0 };
    case "downloaded":
      return { ...prev, phase: "downloaded", version: s.version ?? null };
    case "error":
      return { ...prev, phase: "error", errorMessage: s.message ?? "" };
    default:
      return prev;
  }
}
