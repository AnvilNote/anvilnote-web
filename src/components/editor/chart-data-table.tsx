"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseNumericInput, numericInputValue } from "@/lib/numeric-input";
import { ROW_SHAPE_COLUMNS, emptyRow, type ChartRow, type RowColumn, type RowShapeId } from "@/lib/chart/row-shapes";
import {
  parseCsvText,
  guessColumnMapping,
  isMappingComplete,
  applyColumnMapping,
  type ColumnMapping,
} from "@/lib/chart/csv-import";
import { ChartCsvMappingDialog } from "@/components/editor/chart-csv-mapping-dialog";

const MAX_ROWS = 200;
const DEFAULT_ROW_COUNT = 5;

type PendingCsv = { csvRows: string[][]; guess: ColumnMapping };

export type ChartDataTableProps = {
  rowShape: RowShapeId;
  data: ChartRow[];
  onDataChange: (data: ChartRow[]) => void;
  // scatterplot_matrix only
  vars?: string[];
  varsOptions?: string[];
  onVarsChange?: (vars: string[]) => void;
};

export function ChartDataTable({ rowShape, data, onDataChange, vars, varsOptions, onVarsChange }: ChartDataTableProps) {
  const t = useTranslations("editor.chart");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingCsv, setPendingCsv] = useState<PendingCsv | null>(null);
  // Editable table-header overrides — pre-filled from the CSV's own header
  // text right after an import (so the table stops showing the generic
  // "X"/"Y" internal field names once real data is in) and freely
  // re-editable afterward. Purely local display state, not persisted with
  // the chart: it exists to keep the data entry session readable, not as a
  // saved chart attribute (axis titles/legend already have their own
  // dedicated, persisted fields elsewhere in the dialog).
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>({});

  const columns: RowColumn[] =
    rowShape === "dynamicVars"
      ? [
          ...(vars ?? []).map((v): RowColumn => ({ key: v, labelKey: v, type: "number" })),
          { key: "group", labelKey: "group", type: "text" },
        ]
      : ROW_SHAPE_COLUMNS[rowShape];
  const columnKeySignature = columns.map((c) => c.key).join("|");

  // A different chart type (or a scatterplot_matrix var selection change)
  // means these labels no longer refer to the same columns — stale text
  // from the last shape would otherwise linger under new fields.
  useEffect(() => {
    setColumnLabels({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKeySignature]);

  function columnHeader(col: RowColumn): string {
    return t.has(`fields.${col.labelKey}` as never) ? t(`fields.${col.labelKey}` as never) : col.labelKey;
  }

  function updateCell(index: number, key: string, raw: string) {
    onDataChange(data.map((row, i) => (i === index ? { ...row, [key]: raw } : row)));
  }

  function updateNumericCell(index: number, key: string, raw: string) {
    onDataChange(data.map((row, i) => (i === index ? { ...row, [key]: numericInputValue(parseNumericInput(raw)) } : row)));
  }

  function removeRow(index: number) {
    onDataChange(data.filter((_, i) => i !== index));
  }

  function addRow() {
    if (data.length >= MAX_ROWS) return;
    onDataChange([...data, emptyRow(rowShape, vars)]);
  }

  function clearData() {
    onDataChange(Array.from({ length: DEFAULT_ROW_COUNT }, () => emptyRow(rowShape, vars)));
    setColumnLabels({});
  }

  function importRows(csvRows: string[][], mapping: ColumnMapping) {
    const rows = applyColumnMapping(csvRows, columns, mapping);
    if (rows.length === 0) {
      toast.error(t("csvImportEmpty"));
      return;
    }
    const truncated = rows.length > MAX_ROWS;
    onDataChange(truncated ? rows.slice(0, MAX_ROWS) : rows);

    const header = csvRows[0];
    const labels: Record<string, string> = {};
    for (const col of columns) {
      const idx = mapping[col.key];
      const headerText = idx != null ? header[idx]?.trim() : "";
      if (headerText) labels[col.key] = headerText;
    }
    setColumnLabels(labels);

    if (truncated) {
      toast.warning(t("csvImportTruncated", { count: MAX_ROWS }));
    } else {
      toast.success(t("csvImportSuccess", { count: rows.length }));
    }
  }

  function handleCsvFile(file: File) {
    file
      .text()
      .then((text) => {
        const csvRows = parseCsvText(text);
        if (csvRows.length === 0) {
          toast.error(t("csvImportEmpty"));
          return;
        }
        const guess = guessColumnMapping(csvRows[0], columns);
        // Real spreadsheet exports (Excel/pandas/etc.) almost never use our
        // internal field names (x/y/group/...) — an incomplete guess opens
        // the mapping dialog for the user to fill in themselves rather than
        // rejecting the file outright.
        if (isMappingComplete(guess, columns)) {
          importRows(csvRows, guess);
        } else {
          setPendingCsv({ csvRows, guess });
        }
      })
      .catch(() => toast.error(t("csvImportEmpty")));
  }

  function toggleVar(v: string) {
    if (!vars || !onVarsChange) return;
    if (vars.includes(v)) {
      if (vars.length <= 2) return; // API requires 2-4 vars
      onVarsChange(vars.filter((x) => x !== v));
    } else {
      if (vars.length >= 4) return;
      onVarsChange([...vars, v]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rowShape === "dynamicVars" && varsOptions ? (
        <div className="flex flex-wrap gap-3">
          {varsOptions.map((v) => (
            <label className="flex items-center gap-1.5 text-xs" key={v}>
              <input checked={vars?.includes(v) ?? false} onChange={() => toggleVar(v)} type="checkbox" />
              {v}
            </label>
          ))}
        </div>
      ) : null}
      {/* Fixed height, not max-height — scrolling always stays inside the
          table itself so "新增列/匯入 CSV/清空資料" below it stay put and
          visible regardless of row count, instead of the whole dialog
          column having to scroll to reach them. */}
      <div className="h-[360px] shrink-0 overflow-auto border">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              {columns.map((col) => (
                <th className="border-b p-0 text-left text-xs font-medium text-muted-foreground" key={col.key}>
                  <input
                    className="w-full truncate bg-transparent px-1.5 py-1.5 outline-none focus:bg-accent"
                    onChange={(e) => setColumnLabels({ ...columnLabels, [col.key]: e.target.value })}
                    placeholder={columnHeader(col)}
                    title={columnLabels[col.key] || columnHeader(col)}
                    value={columnLabels[col.key] ?? ""}
                  />
                </th>
              ))}
              <th className="border-b p-1.5" style={{ width: "10%" }} />
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {columns.map((col) => (
                  <td className="border-b border-l p-0" key={col.key}>
                    <input
                      className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                      onChange={(e) =>
                        col.type === "number"
                          ? updateNumericCell(index, col.key, e.target.value)
                          : updateCell(index, col.key, e.target.value)
                      }
                      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                      value={
                        col.type === "number"
                          ? typeof row[col.key] === "number"
                            ? numericInputValue(row[col.key] as number)
                            : ""
                          : (row[col.key] ?? "")
                      }
                    />
                  </td>
                ))}
                <td className="border-b border-l p-1 text-center">
                  <button
                    aria-label={t("removeRow")}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeRow(index)}
                    type="button"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button disabled={data.length >= MAX_ROWS} className="rounded-2xl" onClick={addRow} size="sm" type="button" variant="outline">
          {t("addRow")}
        </Button>
        <Button className="rounded-2xl" onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="outline">
          {t("csvImport")}
        </Button>
        <Button className="rounded-2xl" onClick={clearData} size="sm" type="button" variant="outline">
          {t("clearData")}
        </Button>
        <input
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCsvFile(file);
            e.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>
      {pendingCsv ? (
        <ChartCsvMappingDialog
          columns={columns}
          header={pendingCsv.csvRows[0]}
          initialMapping={pendingCsv.guess}
          onConfirm={(mapping) => {
            importRows(pendingCsv.csvRows, mapping);
            setPendingCsv(null);
          }}
          onOpenChange={(open) => {
            if (!open) setPendingCsv(null);
          }}
          open
          previewRow={pendingCsv.csvRows[1]}
        />
      ) : null}
    </div>
  );
}
