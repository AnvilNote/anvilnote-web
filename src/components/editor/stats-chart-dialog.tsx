"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import { renderStatsChart } from "@/lib/stats-chart-render";
import {
  CHART_TYPE_GROUPS,
  MAX_ENTRIES,
  VISIBLE_ROW_LIMIT,
  chartTypeGroup,
  defaultEntryColor,
  type ChartType,
  type ChartTypeGroup,
} from "@/lib/stats-chart-defaults";
import {
  SPREADSHEET_IMPORT_ACCEPT,
  parseBoxWhiskerSpreadsheet,
  parseCategoricalSpreadsheet,
} from "@/lib/stats-chart-import";
import type { BoxWhiskerEntry, CategoricalEntry, StatsChartSpec } from "@/lib/tiptap/stats-chart";

export type StatsChartDialogProps = {
  open: boolean;
  initialSpec: StatsChartSpec;
  onOpenChange: (open: boolean) => void;
  onSave: (spec: StatsChartSpec, svg: string) => void;
};

export function StatsChartDialog({
  open,
  initialSpec,
  onOpenChange,
  onSave,
}: StatsChartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <StatsChartForm
          initialSpec={initialSpec}
          onCancel={() => onOpenChange(false)}
          onSave={(spec, svg) => {
            onSave(spec, svg);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function defaultCategoricalEntry(index: number): CategoricalEntry {
  return { label: "", value: 0, color: defaultEntryColor(index) };
}

function defaultBoxWhiskerEntry(): BoxWhiskerEntry {
  return { label: "", min: 0, q1: 0, median: 0, q3: 0, max: 0 };
}

function StatsChartForm({
  initialSpec,
  onCancel,
  onSave,
}: {
  initialSpec: StatsChartSpec;
  onCancel: () => void;
  onSave: (spec: StatsChartSpec, svg: string) => void;
}) {
  const t = useTranslations("editor.statsChart");
  const [chartType, setChartTypeRaw] = useState<ChartType>(initialSpec.chartType);
  // Two independent data slices (rather than fighting StatsChartSpec's
  // discriminated union through every keystroke) — switching chart type
  // between bar/column/pie/pyramid keeps categoricalData as-is (same
  // shape), and switching to/from boxwhisker keeps whichever slice isn't
  // currently shown intact in the background, so flipping the picker back
  // and forth doesn't lose already-entered data. The actual discriminated
  // StatsChartSpec is only assembled (via buildSpec below) at the two
  // points that actually need it: the render effect and onSave.
  const [categoricalData, setCategoricalData] = useState<CategoricalEntry[]>(
    initialSpec.chartType === "boxwhisker" ? [defaultCategoricalEntry(0)] : initialSpec.data,
  );
  const [boxWhiskerData, setBoxWhiskerData] = useState<BoxWhiskerEntry[]>(
    initialSpec.chartType === "boxwhisker" ? initialSpec.data : [defaultBoxWhiskerEntry()],
  );
  const [showLegend, setShowLegend] = useState(
    initialSpec.chartType === "pie" ? initialSpec.showLegend : true,
  );
  // Caps the visible rows at VISIBLE_ROW_LIMIT (matches a spreadsheet
  // showing the first screenful of rows) rather than always rendering up
  // to MAX_ENTRIES (20) at once — "Show more" reveals the rest on demand.
  const [showAllRows, setShowAllRows] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  // Tracks which spec previewSvg was actually rendered for, as a JSON key —
  // NOT just whether a render happened. Without this, switching chart type
  // (e.g. bar -> boxwhisker) leaves the old chart's SVG sitting in
  // previewSvg; hasLabel briefly goes false (new slice starts empty) so the
  // render effect's early-return never clears it, and once the user types
  // one character into the new slice, `hasLabel && previewSvg` would show —
  // and Save would persist — the PREVIOUS chart type's image under the NEW
  // spec's chartType/data. Comparing against currentSpecKey below prevents
  // ever displaying or saving an SVG that doesn't match the spec on screen.
  const [renderedFor, setRenderedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isBoxWhisker = chartType === "boxwhisker";
  const activeData = isBoxWhisker ? boxWhiskerData : categoricalData;
  // Same rationale as function-plot-dialog's hasFormula: skip rendering
  // until the user has actually typed something, gate the display on this
  // (not effect-cleared state) — see that file's own comment for why.
  const hasLabel = activeData.some((entry) => entry.label.trim());

  // Pairs each entry with its ORIGINAL array index before slicing to the
  // visible-row limit, so update/removeEntry (which index into the full
  // categoricalData/boxWhiskerData arrays) still target the right row once
  // rows beyond VISIBLE_ROW_LIMIT are hidden.
  const categoricalRows = categoricalData.map((entry, index) => ({ entry, index }));
  const boxWhiskerRows = boxWhiskerData.map((entry, index) => ({ entry, index }));
  const visibleCategoricalRows = showAllRows
    ? categoricalRows
    : categoricalRows.slice(0, VISIBLE_ROW_LIMIT);
  const visibleBoxWhiskerRows = showAllRows ? boxWhiskerRows : boxWhiskerRows.slice(0, VISIBLE_ROW_LIMIT);
  const hiddenRowCount = activeData.length - Math.min(activeData.length, VISIBLE_ROW_LIMIT);

  function buildSpec(): StatsChartSpec {
    if (chartType === "boxwhisker") return { chartType, data: boxWhiskerData };
    if (chartType === "pie") return { chartType, data: categoricalData, showLegend };
    return { chartType, data: categoricalData };
  }

  const currentSpecKey = JSON.stringify(buildSpec());
  const isPreviewCurrent = hasLabel && renderedFor === currentSpecKey;

  useEffect(() => {
    if (!hasLabel) return;
    const controller = new AbortController();
    const specKeyAtRequestTime = currentSpecKey;
    const timer = setTimeout(() => {
      setLoading(true);
      renderStatsChart(buildSpec(), controller.signal)
        .then((svg) => {
          setPreviewSvg(svg);
          setRenderedFor(specKeyAtRequestTime);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name !== "AbortError") {
            setError(err.message);
          }
        })
        .finally(() => setLoading(false));
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpecKey]);

  function updateCategoricalEntry(index: number, patch: Partial<CategoricalEntry>) {
    setCategoricalData((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function updateBoxWhiskerEntry(index: number, patch: Partial<BoxWhiskerEntry>) {
    setBoxWhiskerData((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function addEntry() {
    if (isBoxWhisker) {
      setBoxWhiskerData((prev) => (prev.length >= MAX_ENTRIES ? prev : [...prev, defaultBoxWhiskerEntry()]));
    } else {
      setCategoricalData((prev) =>
        prev.length >= MAX_ENTRIES ? prev : [...prev, defaultCategoricalEntry(prev.length)],
      );
    }
  }

  function removeEntry(index: number) {
    if (isBoxWhisker) {
      setBoxWhiskerData((prev) => prev.filter((_, i) => i !== index));
    } else {
      setCategoricalData((prev) => prev.filter((_, i) => i !== index));
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately (not after the parse) so re-selecting the SAME
    // file still fires onChange next time — the browser only fires it on
    // a value change, and without this a second pick of the same path
    // would otherwise silently do nothing.
    event.target.value = "";
    if (!file) return;
    try {
      if (isBoxWhisker) {
        const entries = await parseBoxWhiskerSpreadsheet(file);
        setBoxWhiskerData(entries.length > 0 ? entries : [defaultBoxWhiskerEntry()]);
      } else {
        const entries = await parseCategoricalSpreadsheet(file);
        setCategoricalData(entries.length > 0 ? entries : [defaultCategoricalEntry(0)]);
      }
      setShowAllRows(false);
      setImportError(null);
    } catch {
      setImportError(t("importError"));
    }
  }

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="stats-chart-type">
                {t("chartType")}
              </label>
              <Select
                onValueChange={(value) => {
                  const group = value as ChartTypeGroup;
                  if (group === "bar") {
                    // Defaults to vertical (column) for a freshly-selected
                    // bar-chart group; preserves the existing orientation if
                    // the group was already active (switching pie -> bar and
                    // bar(horizontal) -> pie -> bar should restore horizontal).
                    setChartTypeRaw((prev) => (prev === "bar" || prev === "column" ? prev : "column"));
                  } else {
                    setChartTypeRaw(group);
                  }
                }}
                value={chartTypeGroup(chartType)}
              >
                <SelectTrigger id="stats-chart-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_TYPE_GROUPS.map((group) => (
                    <SelectItem key={group} value={group}>
                      {t(`chartTypes.${group}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {chartTypeGroup(chartType) === "bar" ? (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Switch
                  checked={chartType === "bar"}
                  onCheckedChange={(checked) => setChartTypeRaw(checked ? "bar" : "column")}
                />
                {t("horizontal")}
              </label>
            ) : null}
            <Button
              className="mb-0.5"
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("importFile")}
            </Button>
            <input
              accept={SPREADSHEET_IMPORT_ACCEPT}
              className="hidden"
              onChange={handleImportFile}
              ref={fileInputRef}
              type="file"
            />
          </div>
          {importError ? <p className="text-destructive text-sm">{importError}</p> : null}

          {/* Spreadsheet-style grid (bordered cells, no per-field labels) —
              replaces an earlier one-Input-per-line layout per explicit
              feedback that it didn't read as "a place to enter data" the
              way a familiar table does. Cell inputs are borderless; the
              <td> borders themselves form the grid lines. */}
          <div className="overflow-x-auto rounded-md border">
            {/* table-fixed + explicit percentage widths on the header row —
                NOT the native `size` attribute + auto layout this replaced.
                That approach let the Label column collapse to ~0 width in
                practice: a table cell's <input> doesn't reliably report its
                "size"-driven intrinsic width to the browser's column-width
                calculation, especially before any text is typed. Fixed
                percentages guarantee every column keeps a real, visible
                width regardless of content. Ratio is 5:2:3 for
                Label:Value:Color (45%/18%/27%), with Remove as a small
                fixed remainder (10%) outside the ratio — matches explicit
                feedback on the input-area proportions. */}
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th
                    className="border-b p-1.5 text-left text-xs font-medium text-muted-foreground"
                    style={{ width: isBoxWhisker ? "25%" : "45%" }}
                  >
                    {t("label")}
                  </th>
                  {isBoxWhisker ? (
                    <>
                      <th
                        className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                        style={{ width: "13%" }}
                      >
                        {t("min")}
                      </th>
                      <th
                        className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                        style={{ width: "13%" }}
                      >
                        {t("q1")}
                      </th>
                      <th
                        className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                        style={{ width: "13%" }}
                      >
                        {t("median")}
                      </th>
                      <th
                        className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                        style={{ width: "13%" }}
                      >
                        {t("q3")}
                      </th>
                      <th
                        className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                        style={{ width: "13%" }}
                      >
                        {t("max")}
                      </th>
                    </>
                  ) : (
                    <th
                      className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                      style={{ width: "18%" }}
                    >
                      {t("value")}
                    </th>
                  )}
                  {isBoxWhisker ? null : (
                    <th className="border-b border-l p-1.5" style={{ width: "27%" }} />
                  )}
                  <th className="border-b border-l p-1.5" style={{ width: "10%" }} />
                </tr>
              </thead>
              <tbody>
                {isBoxWhisker
                  ? visibleBoxWhiskerRows.map(({ entry, index }) => (
                      <tr key={index}>
                        <td className="border-b p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateBoxWhiskerEntry(index, { label: event.target.value })
                            }
                            value={entry.label}
                          />
                        </td>
                        <td className="border-b border-l p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateBoxWhiskerEntry(index, { min: Number(event.target.value) })
                            }
                            type="number"
                            value={entry.min}
                          />
                        </td>
                        <td className="border-b border-l p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateBoxWhiskerEntry(index, { q1: Number(event.target.value) })
                            }
                            type="number"
                            value={entry.q1}
                          />
                        </td>
                        <td className="border-b border-l p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateBoxWhiskerEntry(index, { median: Number(event.target.value) })
                            }
                            type="number"
                            value={entry.median}
                          />
                        </td>
                        <td className="border-b border-l p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateBoxWhiskerEntry(index, { q3: Number(event.target.value) })
                            }
                            type="number"
                            value={entry.q3}
                          />
                        </td>
                        <td className="border-b border-l p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateBoxWhiskerEntry(index, { max: Number(event.target.value) })
                            }
                            type="number"
                            value={entry.max}
                          />
                        </td>
                        <td className="border-b border-l p-1 text-center">
                          {boxWhiskerData.length > 1 ? (
                            <button
                              aria-label={t("removeEntry")}
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => removeEntry(index)}
                              type="button"
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  : visibleCategoricalRows.map(({ entry, index }) => (
                      <tr key={index}>
                        <td className="border-b p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateCategoricalEntry(index, { label: event.target.value })
                            }
                            value={entry.label}
                          />
                        </td>
                        <td className="border-b border-l p-0">
                          <input
                            className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                            onChange={(event) =>
                              updateCategoricalEntry(index, { value: Number(event.target.value) })
                            }
                            type="number"
                            value={entry.value}
                          />
                        </td>
                        <td className="border-b border-l p-0">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                aria-label={t("entryColor")}
                                className="flex w-full items-center gap-1.5 px-2 py-1.5 hover:bg-accent"
                                onMouseDown={(event) => event.stopPropagation()}
                                type="button"
                              >
                                <span
                                  className="size-4 shrink-0 rounded-sm border"
                                  style={{ backgroundColor: entry.color ?? defaultEntryColor(index) }}
                                />
                                <span className="truncate font-mono text-xs text-muted-foreground">
                                  {entry.color ?? defaultEntryColor(index)}
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-64"
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                              <ColorPicker
                                className="gap-3"
                                onChange={(rgba) => {
                                  const [r, g, b] = rgba as [number, number, number, number];
                                  const hex = `#${[r, g, b]
                                    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
                                    .join("")}`;
                                  updateCategoricalEntry(index, { color: hex });
                                }}
                                value={entry.color ?? defaultEntryColor(index)}
                              >
                                <ColorPickerSelection className="h-32" />
                                <ColorPickerHue />
                                <div className="flex items-center gap-2">
                                  <ColorPickerEyeDropper />
                                  <ColorPickerOutput />
                                </div>
                                <ColorPickerFormat />
                              </ColorPicker>
                            </PopoverContent>
                          </Popover>
                        </td>
                        <td className="border-b border-l p-1 text-center">
                          {categoricalData.length > 1 ? (
                            <button
                              aria-label={t("removeEntry")}
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => removeEntry(index)}
                              type="button"
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {hiddenRowCount > 0 ? (
            <Button onClick={() => setShowAllRows(true)} size="sm" variant="ghost">
              {t("showMoreRows", { count: hiddenRowCount })}
            </Button>
          ) : showAllRows && activeData.length > VISIBLE_ROW_LIMIT ? (
            <Button onClick={() => setShowAllRows(false)} size="sm" variant="ghost">
              {t("showFewerRows")}
            </Button>
          ) : null}

          <Button
            disabled={activeData.length >= MAX_ENTRIES}
            onClick={addEntry}
            size="sm"
            variant="outline"
          >
            {activeData.length >= MAX_ENTRIES ? t("entryLimitReached") : t("addEntry")}
          </Button>

          {chartType === "pie" ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showLegend} onCheckedChange={setShowLegend} />
              {t("showLegend")}
            </label>
          ) : null}
        </div>
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded border p-2">
          {isPreviewCurrent && previewSvg ? (
            <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
          ) : hasLabel && loading ? (
            <span className="text-muted-foreground text-sm">{t("previewLoading")}</span>
          ) : null}
          {hasLabel && error ? <p className="text-destructive text-sm">{t("previewError")}</p> : null}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onCancel} variant="ghost">
          {t("cancel")}
        </Button>
        <Button
          disabled={!isPreviewCurrent || !previewSvg}
          onClick={() => isPreviewCurrent && previewSvg && onSave(buildSpec(), previewSvg)}
        >
          {t("save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
