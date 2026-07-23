"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { useSettingsDialogStore } from "@/lib/stores/ui-store";

// Settings is a modal now, not a routed page — this only exists so old
// deep links (bookmarks, a persisted last-route from before this change)
// still do something sensible: open the dialog over the documents list
// instead of 404ing or rendering a bare page.
export default function SettingsPage() {
  const router = useRouter();
  const openSettings = useSettingsDialogStore((s) => s.openSettings);

  useEffect(() => {
    openSettings();
    router.replace("/documents");
  }, [openSettings, router]);

  return null;
}
