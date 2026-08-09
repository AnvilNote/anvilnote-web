"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useChangelogStore } from "@/lib/stores/changelog-store";
import { renderChangelogBullet } from "@/lib/changelog/render-inline";
import { cn } from "@/lib/utils";

// One row per version, collapsed by default except the newest (the one a
// user opening this panel almost always wants) -- clicking anywhere on a
// row's header toggles it, independent of every other row (not an
// accordion that closes siblings), so comparing two versions' notes side by
// side just means opening both.
export function ChangelogSettings() {
  const entries = useChangelogStore((s) => s.entries);
  const [openVersions, setOpenVersions] = useState<ReadonlySet<string>>(
    () => new Set(entries[0] ? [entries[0].version] : []),
  );

  function toggle(version: string) {
    setOpenVersions((current) => {
      const next = new Set(current);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  }

  return (
    <div className="divide-y">
      {entries.map((entry) => {
        const isOpen = openVersions.has(entry.version);
        return (
          <div key={entry.version}>
            <button
              type="button"
              onClick={() => toggle(entry.version)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">v{entry.version}</span>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen ? (
              <ul className="space-y-1.5 px-3 pb-3 text-sm text-muted-foreground">
                {entry.bullets.map((bullet, index) => (
                  <li key={index} className="flex gap-2">
                    <span aria-hidden className="select-none">
                      •
                    </span>
                    <span>{renderChangelogBullet(bullet)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
