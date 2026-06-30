"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/lib/stores/document-store";

export type SaveStatus = "saved" | "saving" | "unsaved";

// Presentational indicator driven by an explicit status (used by the landing
// demo, which has no store-backed document).
export function AutosaveIndicatorView({ status }: { status: SaveStatus }) {
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

// Subscribes to the save status itself so the per-keystroke status flips
// (saved → unsaved → saving) re-render ONLY this indicator, not the whole editor
// component. Re-rendering the editor on every keystroke would run useEditor's
// onRender (setOptions → view.setProps/updateState), which tears down an open
// "/" suggestion popup.
export function AutosaveIndicator({ documentId }: { documentId: string }) {
  const status = useDocumentStore((s) => s.saveStateById[documentId] ?? "saved");
  return <AutosaveIndicatorView status={status} />;
}
