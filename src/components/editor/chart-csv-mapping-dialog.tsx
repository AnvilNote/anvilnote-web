"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RowColumn } from "@/lib/chart/row-shapes";
import { isMappingComplete, type ColumnMapping } from "@/lib/chart/csv-import";

const UNSET = "__unset__";

export type ChartCsvMappingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  header: string[];
  previewRow: string[] | undefined;
  columns: RowColumn[];
  initialMapping: ColumnMapping;
  onConfirm: (mapping: ColumnMapping) => void;
};

// Shown whenever a picked CSV's header doesn't already name-match every
// column the current chart type needs (real spreadsheet exports almost
// never do — see csv-import.ts's own comment). Pre-filled with whatever
// guessColumnMapping() could figure out from the header text; the user
// fixes the rest by picking, per chart field, which actual CSV column it
// comes from.
export function ChartCsvMappingDialog({
  open,
  onOpenChange,
  header,
  previewRow,
  columns,
  initialMapping,
  onConfirm,
}: ChartCsvMappingDialogProps) {
  const t = useTranslations("editor.chart");
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);

  function setColumn(key: string, value: string) {
    setMapping((prev) => ({ ...prev, [key]: value === UNSET ? null : Number(value) }));
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) setMapping(initialMapping);
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent
        className="max-w-md rounded-2xl"
        // Losing an already-picked CSV file (and having to re-open the file
        // picker) to a stray click just outside this small dialog was the
        // exact complaint that led to this same fix on the main chart
        // dialog — only Cancel/Confirm/Esc should dismiss it now.
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("csvMappingTitle")}</DialogTitle>
          <DialogDescription>{t("csvMappingDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {columns.map((col) => {
            const idx = mapping[col.key];
            return (
              <div className="flex items-center justify-between gap-3" key={col.key}>
                <span className="w-28 shrink-0 text-sm">
                  {t.has(`fields.${col.labelKey}` as never) ? t(`fields.${col.labelKey}` as never) : col.labelKey}
                </span>
                <Select onValueChange={(v) => setColumn(col.key, v)} value={idx != null ? String(idx) : UNSET}>
                  <SelectTrigger className="h-8 flex-1 rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value={UNSET}>{t("csvMappingUnset")}</SelectItem>
                    {header.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h.trim() || `#${i + 1}`}
                        {previewRow?.[i] ? ` (${previewRow[i]})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button className="rounded-2xl" onClick={() => onOpenChange(false)} type="button" variant="outline">
            {t("cancel")}
          </Button>
          <Button
            className="rounded-2xl"
            disabled={!isMappingComplete(mapping, columns)}
            onClick={() => onConfirm(mapping)}
            type="button"
          >
            {t("csvMappingConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
