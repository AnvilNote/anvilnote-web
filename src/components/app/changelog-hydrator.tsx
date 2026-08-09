"use client";

import { useEffect } from "react";
import { useChangelogStore } from "@/lib/stores/changelog-store";
import type { ChangelogEntry } from "@/lib/changelog/parse";

// Pushes the server-read changelog (read.server.ts, via the locale layout)
// into the client store once on mount. Not part of StoreHydrator's own
// rehydrate chain -- that one gates children on localStorage persistence
// finishing; this has nothing to persist or wait on, it's just handing off
// data the server already had.
export function ChangelogHydrator({ entries }: { entries: ChangelogEntry[] }) {
  useEffect(() => {
    useChangelogStore.getState().setEntries(entries);
  }, [entries]);

  return null;
}
