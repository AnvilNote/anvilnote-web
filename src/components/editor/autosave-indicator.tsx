"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type SaveStatus = "saved" | "saving" | "unsaved";

export function AutosaveIndicator({ status }: { status: SaveStatus }) {
  const t = useTranslations("editor.autosave");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        status === "saved" ? "text-[#00CF00]" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          status === "saved" && "bg-[#00CF00]",
          status === "saving" && "animate-pulse bg-foreground/60",
          status === "unsaved" && "bg-foreground/25",
        )}
      />
      {/* Fixed-width label so swapping states (儲存中… → 已儲存) never changes
          the indicator size and jolts the header layout. */}
      <span className="hidden min-w-[3.75rem] md:inline-block">{t(status)}</span>
    </span>
  );
}
