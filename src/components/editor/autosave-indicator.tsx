"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type SaveStatus = "saved" | "saving" | "unsaved";

export function AutosaveIndicator({ status }: { status: SaveStatus }) {
  const t = useTranslations("editor.autosave");

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          status === "saved" && "bg-foreground/40",
          status === "saving" && "animate-pulse bg-foreground/60",
          status === "unsaved" && "bg-foreground/25",
        )}
      />
      {t(status)}
    </span>
  );
}
