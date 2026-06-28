"use client";

import { useEffect, useState } from "react";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

export function StoreHydrator({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.resolve(useSettingsStore.persist.rehydrate())
      .then(() => useDocumentStore.getState().hydrate())
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
