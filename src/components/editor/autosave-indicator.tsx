"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/lib/stores/document-store";

export type SaveStatus = "saved" | "saving" | "unsaved" | "failed";

// Presentational indicator driven by an explicit status (used by the landing
// demo, which has no store-backed document).
export function AutosaveIndicatorView({ status }: { status: SaveStatus }) {
  const t = useTranslations("editor.autosave");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        status === "saved" && "text-[#00CF00]",
        status === "failed" && "text-destructive",
        (status === "saving" || status === "unsaved") && "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          status === "saved" && "bg-[#00CF00]",
          status === "saving" && "animate-pulse bg-foreground/60",
          status === "unsaved" && "bg-foreground/25",
          status === "failed" && "bg-destructive",
        )}
      />
      {/* Content-width, not a fixed min-width reserved for the longest
          label across every locale/state ("Save failed" is the widest,
          but it's also the rarest — not worth widening the indicator for
          the common "Saved" case just to avoid it). Hidden below a
          container width (not viewport width — this row sits next to the
          toolbar, which can eat all the room well above any viewport
          breakpoint), so the dot alone still shows once the row is tight
          instead of forcing the toolbar row to wrap. */}
      <span className="hidden @[22rem]:inline-block">{t(status)}</span>
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
