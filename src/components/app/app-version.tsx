"use client";

import { useSyncExternalStore } from "react";
import packageJson from "../../../package.json";

// Build-time fallback (this web package's own version) — used for both the
// server render and the very first client render so hydration never
// mismatches. The desktop shell's real (possibly different) app version, only
// available via the Electron preload bridge, replaces it right after mount.
const BUILD_TIME_VERSION: string = packageJson.version;

// The bridged version is static for the lifetime of the page, so there's
// nothing to subscribe to — just don't unsubscribe from anything.
function subscribe() {
  return () => {};
}

function getSnapshot(): string {
  return window.anvilnote?.getAppVersion?.() ?? BUILD_TIME_VERSION;
}

function getServerSnapshot(): string {
  return BUILD_TIME_VERSION;
}

export function AppVersion() {
  const version = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="px-3 pb-2 text-xs text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
      v{version}
    </div>
  );
}
