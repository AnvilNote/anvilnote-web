"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Table as TableIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Largest table the picker offers (rows × cols).
export const TABLE_PICKER_MAX = 10;

// Shared hover grid: the user sweeps the pointer (or tabs with the keyboard) to
// highlight a rows × cols rectangle, then clicks to commit. Used by both the
// toolbar popover and the slash-command dialog so the experience is identical.
export function TableSizeGrid({
  label,
  onPick,
}: {
  /** Shown above the grid until a cell is hovered (then it shows the size). */
  label: string;
  onPick: (rows: number, cols: number) => void;
}) {
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="text-center text-xs font-medium text-muted-foreground tabular-nums">
        {hover ? `${hover.rows} × ${hover.cols}` : label}
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${TABLE_PICKER_MAX}, 1fr)` }}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: TABLE_PICKER_MAX * TABLE_PICKER_MAX }, (_, i) => {
          const rows = Math.floor(i / TABLE_PICKER_MAX) + 1;
          const cols = (i % TABLE_PICKER_MAX) + 1;
          const selected =
            hover != null && rows <= hover.rows && cols <= hover.cols;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${rows} × ${cols}`}
              onMouseEnter={() => setHover({ rows, cols })}
              onFocus={() => setHover({ rows, cols })}
              onClick={() => onPick(rows, cols)}
              className={cn(
                "size-4 rounded-[3px] border transition-colors",
                selected
                  ? "border-primary bg-primary/70"
                  : "border-border bg-muted hover:border-primary/50",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

// Modal wrapper around the grid, used by the slash command (which has no anchor
// element to attach a popover to).
export function TableSizeDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (rows: number, cols: number) => void;
}) {
  const t = useTranslations("editor");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto sm:max-w-fit">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="size-4" />
            {t("slash.table")}
          </DialogTitle>
          <DialogDescription>{t("table.pickSize")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-1">
          <TableSizeGrid
            label={t("table.pickSize")}
            onPick={(rows, cols) => {
              onPick(rows, cols);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
