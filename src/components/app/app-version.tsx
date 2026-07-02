"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import packageJson from "../../../package.json";
import { LATEST_RELEASE_PAGE_URL } from "@/lib/update-check";
import { selectHasUpdate, useUpdateStore } from "@/lib/stores/update-store";

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

export function useAppVersion(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Only the desktop shell ships releases; a plain web build has no bridge.
export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && Boolean(window.anvilnote?.getAppVersion);
}

export function AppVersion() {
  const t = useTranslations("settings.update");
  const version = useAppVersion();
  const checkForUpdate = useUpdateStore((s) => s.checkForUpdate);
  const hasUpdate = useUpdateStore(selectHasUpdate(version));
  const isDesktop = isDesktopShell();

  useEffect(() => {
    if (isDesktop) void checkForUpdate();
  }, [isDesktop, checkForUpdate]);

  return (
    <div className="flex items-center gap-2 px-3 pb-2 text-xs text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
      <span>v{version}</span>
      {isDesktop && hasUpdate ? (
        <a
          href={LATEST_RELEASE_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
        >
          {t("available")}
        </a>
      ) : null}
    </div>
  );
}
