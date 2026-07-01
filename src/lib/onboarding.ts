"use client";

const STORAGE_KEY = "anvilnote.onboarding.done";

// Whether the user has ever completed the language/theme picker. Separate
// from the splash screen (which always plays every launch) and from the
// tour's own "seen" flag (tour-store.ts) — each first-run experience tracks
// itself independently. Plain functions rather than a store: only
// FirstRunOnboarding reads/writes this, once, on mount.
export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore (private mode / disabled storage)
  }
}
