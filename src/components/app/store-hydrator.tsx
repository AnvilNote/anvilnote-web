"use client";

import { useEffect, useState } from "react";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";

export function StoreHydrator({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.resolve(useSettingsStore.persist.rehydrate())
      // Templates must be loaded before documents so seeding and template
      // switches can read manifest fields synchronously.
      .then(() => useTemplatesStore.getState().load())
      .then(() =>
        Promise.all([
          useDocumentStore.getState().hydrate(),
          useProjectStore.getState().hydrate(),
        ]),
      )
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
