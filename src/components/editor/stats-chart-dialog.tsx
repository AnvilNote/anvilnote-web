"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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
  CROWDED_ENTRY_THRESHOLD,
  MAX_ENTRIES,
  SCATTER_MAX_ENTRIES,
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
  parseScatterSpreadsheet,
} from "@/lib/stats-chart-import";
import { parseNumericInput, numericInputValue } from "@/lib/numeric-input";
import type {
  BoxWhiskerEntry,
  CategoricalEntry,
  FontFamily,
  PercentagePlacement,
  StatsChartSpec,
  TrendLine,
} from "@/lib/tiptap/stats-chart";

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

// Scatter rows are tracked as DRAFT STRINGS (not numbers) — same
// NaN-as-empty-sentinel-adjacent pattern used elsewhere for numeric
// inputs, but here the string itself IS the state, not a parsed number,
// because scatter has no label to detect a "blank" row by: (0, 0) is a
// legitimate real data point, so emptiness must be tracked by the input
// text being blank, not by the parsed value being some sentinel number.
type ScatterDraftEntry = { x: string; y: string };

function defaultScatterEntry(): ScatterDraftEntry {
  return { x: "", y: "" };
}

// Pads an existing (already-saved) chart's data up to VISIBLE_ROW_LIMIT
// (5) blank rows when reopened with fewer — same "don't make the user
// click Add entry repeatedly" rationale as the fresh-node default, but
// this also applies to a chart that already HAS data: reopening a
// 2-entry chart should still show 5 rows (2 filled + 3 blank), not just
// the 2 that were saved, per explicit feedback. Never truncates — a
// chart with more entries than the limit keeps all of them (visible via
// "Show more", not touched here).
function padCategoricalData(data: CategoricalEntry[]): CategoricalEntry[] {
  if (data.length >= VISIBLE_ROW_LIMIT) return data;
  const padding = Array.from({ length: VISIBLE_ROW_LIMIT - data.length }, (_, i) =>
    defaultCategoricalEntry(data.length + i),
  );
  return [...data, ...padding];
}

function padBoxWhiskerData(data: BoxWhiskerEntry[]): BoxWhiskerEntry[] {
  if (data.length >= VISIBLE_ROW_LIMIT) return data;
  const padding = Array.from({ length: VISIBLE_ROW_LIMIT - data.length }, () => defaultBoxWhiskerEntry());
  return [...data, ...padding];
}

function padScatterData(data: ScatterDraftEntry[]): ScatterDraftEntry[] {
  if (data.length >= VISIBLE_ROW_LIMIT) return data;
  const padding = Array.from({ length: VISIBLE_ROW_LIMIT - data.length }, () => defaultScatterEntry());
  return [...data, ...padding];
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
  // Starts with VISIBLE_ROW_LIMIT (5) empty rows when there's no prior
  // data for that shape yet (e.g. switching to box-whisker for the first
  // time in this session) — same "don't make the user click Add entry
  // repeatedly" rationale as stats-chart.ts's own node-level defaults.
  const [categoricalData, setCategoricalData] = useState<CategoricalEntry[]>(
    initialSpec.chartType === "boxwhisker" || initialSpec.chartType === "scatter"
      ? Array.from({ length: VISIBLE_ROW_LIMIT }, (_, index) => defaultCategoricalEntry(index))
      : padCategoricalData(initialSpec.data),
  );
  const [boxWhiskerData, setBoxWhiskerData] = useState<BoxWhiskerEntry[]>(
    initialSpec.chartType === "boxwhisker"
      ? padBoxWhiskerData(initialSpec.data)
      : Array.from({ length: VISIBLE_ROW_LIMIT }, () => defaultBoxWhiskerEntry()),
  );
  const [scatterData, setScatterData] = useState<ScatterDraftEntry[]>(
    initialSpec.chartType === "scatter"
      ? padScatterData(initialSpec.data.map((p) => ({ x: String(p.x), y: String(p.y) })))
      : Array.from({ length: VISIBLE_ROW_LIMIT }, () => defaultScatterEntry()),
  );
  const [showLegend, setShowLegend] = useState(
    initialSpec.chartType === "pie" ? initialSpec.showLegend : true,
  );
  const [showPercentage, setShowPercentage] = useState<PercentagePlacement>(
    initialSpec.chartType === "pie" ? initialSpec.showPercentage : "none",
  );
  const [showValues, setShowValues] = useState(
    initialSpec.chartType === "bar" || initialSpec.chartType === "column"
      ? initialSpec.showValues
      : false,
  );
  const [showGridLines, setShowGridLines] = useState(
    initialSpec.chartType === "bar" ||
      initialSpec.chartType === "column" ||
      initialSpec.chartType === "scatter"
      ? initialSpec.showGridLines
      : true,
  );
  const hasAxisLabelFields =
    initialSpec.chartType === "bar" ||
    initialSpec.chartType === "column" ||
    initialSpec.chartType === "line" ||
    initialSpec.chartType === "scatter";
  const [xLabel, setXLabel] = useState(hasAxisLabelFields ? initialSpec.xLabel : "");
  const [yLabel, setYLabel] = useState(hasAxisLabelFields ? initialSpec.yLabel : "");
  const [yLabelRotated, setYLabelRotated] = useState(
    hasAxisLabelFields ? initialSpec.yLabelRotated : true,
  );
  const [trendLine, setTrendLine] = useState<TrendLine>(
    initialSpec.chartType === "scatter" ? initialSpec.trendLine : "none",
  );
  const [trendLineColor, setTrendLineColor] = useState(
    initialSpec.chartType === "scatter" ? initialSpec.trendLineColor : "#737373",
  );
  // Trend-line color has just one Popover (not per-row like the entry
  // color pickers below), so a simple boolean is enough — no shared
  // "which index is open" state needed since there's nothing else to be
  // mutually exclusive with.
  const [trendLineColorOpen, setTrendLineColorOpen] = useState(false);
  const [fontFamily, setFontFamily] = useState<FontFamily>(initialSpec.fontFamily);
  // Caps the visible rows at VISIBLE_ROW_LIMIT (matches a spreadsheet
  // showing the first screenful of rows) rather than always rendering up
  // to MAX_ENTRIES (20) at once — "Show more" reveals the rest on demand.
  const [showAllRows, setShowAllRows] = useState(false);
  // Checkbox-based batch delete — a SEPARATE action from the per-row ×
  // button (which clears a row's contents in place, not remove it; see
  // clearEntry's own comment). Indices are into the full
  // categoricalData/boxWhiskerData array (same convention as
  // categoricalRows/boxWhiskerRows below), so they still make sense
  // whichever view (compact/expanded) is currently showing them.
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  // Which row's color popover is open, by its stable data-array index (not
  // its position within a possibly-sliced view — see categoricalRows/
  // boxWhiskerRows below) — null when none is. Controlled/mutually
  // exclusive across every row's Popover: two independent uncontrolled
  // Popovers don't close each other, so clicking a second row's color
  // swatch while an earlier row's was still open left both visibly open
  // at once, overlapping (same bug class as blockquote-node-view.tsx's
  // author/source popovers, fixed the same way there).
  const [openColorRow, setOpenColorRow] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // Shown as the expanded full-table view's subtitle — null until the
  // user actually imports a file (manually-entered data has no filename).
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
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
  const isScatter = chartType === "scatter";
  const activeData = isBoxWhisker ? boxWhiskerData : categoricalData;
  // Same rationale as function-plot-dialog's hasFormula: skip rendering
  // until the user has actually typed something, gate the display on this
  // (not effect-cleared state) — see that file's own comment for why.
  // Scatter has no label field to check — a row counts once BOTH its x
  // and y draft strings are non-empty (see ScatterDraftEntry's own
  // comment for why (0, 0) can't be told apart from "blank" any other
  // way).
  const hasLabel = isScatter
    ? scatterData.some((entry) => entry.x.trim() && entry.y.trim())
    : activeData.some((entry) => entry.label.trim());

  // Pairs each entry with its ORIGINAL array index before slicing to the
  // visible-row limit, so update/clearEntry (which index into the full
  // categoricalData/boxWhiskerData arrays) still target the right row once
  // rows beyond VISIBLE_ROW_LIMIT are hidden.
  const categoricalRows = categoricalData.map((entry, index) => ({ entry, index }));
  const boxWhiskerRows = boxWhiskerData.map((entry, index) => ({ entry, index }));
  const scatterRows = scatterData.map((entry, index) => ({ entry, index }));
  const visibleCategoricalRows = showAllRows
    ? categoricalRows
    : categoricalRows.slice(0, VISIBLE_ROW_LIMIT);
  const visibleBoxWhiskerRows = showAllRows ? boxWhiskerRows : boxWhiskerRows.slice(0, VISIBLE_ROW_LIMIT);
  const visibleScatterRows = showAllRows ? scatterRows : scatterRows.slice(0, VISIBLE_ROW_LIMIT);
  const hiddenRowCount = isScatter
    ? scatterData.length - Math.min(scatterData.length, VISIBLE_ROW_LIMIT)
    : activeData.length - Math.min(activeData.length, VISIBLE_ROW_LIMIT);

  function buildSpec(): StatsChartSpec {
    // Rows with a blank label are filtered out here, not just left in —
    // a freshly-inserted node starts with VISIBLE_ROW_LIMIT (5) empty
    // rows (see stats-chart.ts's defaultCategoricalData/
    // defaultBoxWhiskerData), and the API's per-entry schema requires a
    // non-empty label, so any trailing unfilled rows would otherwise fail
    // validation the moment the user has typed into even one earlier row.
    if (chartType === "boxwhisker") {
      return { chartType, data: boxWhiskerData.filter((entry) => entry.label.trim()), fontFamily };
    }
    if (chartType === "scatter") {
      const scatterPoints = scatterData
        .filter((entry) => entry.x.trim() && entry.y.trim())
        .map((entry) => ({ x: Number(entry.x), y: Number(entry.y) }));
      return {
        chartType,
        data: scatterPoints,
        fontFamily,
        trendLine,
        trendLineColor,
        showGridLines,
        xLabel,
        yLabel,
        yLabelRotated,
      };
    }
    const filteredData = categoricalData.filter((entry) => entry.label.trim());
    if (chartType === "pie") {
      return { chartType, data: filteredData, showLegend, showPercentage, fontFamily };
    }
    if (chartType === "line") {
      return { chartType, data: filteredData, fontFamily, xLabel, yLabel, yLabelRotated };
    }
    return { chartType, data: filteredData, showValues, showGridLines, fontFamily, xLabel, yLabel, yLabelRotated };
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

  function updateScatterEntry(index: number, patch: Partial<ScatterDraftEntry>) {
    setScatterData((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function addEntry() {
    if (isBoxWhisker) {
      setBoxWhiskerData((prev) => (prev.length >= MAX_ENTRIES ? prev : [...prev, defaultBoxWhiskerEntry()]));
    } else if (isScatter) {
      setScatterData((prev) =>
        prev.length >= SCATTER_MAX_ENTRIES ? prev : [...prev, defaultScatterEntry()],
      );
    } else {
      setCategoricalData((prev) =>
        prev.length >= MAX_ENTRIES ? prev : [...prev, defaultCategoricalEntry(prev.length)],
      );
    }
  }

  // Clears a row's contents in place — like an Excel cell's Delete key —
  // rather than removing it from the array, per explicit feedback. This
  // also means the row count never shrinks from this button, so there's
  // no need to guard against removing the last remaining row (unlike the
  // earlier "delete/splice" version, which had to hide this button when
  // only 1 row was left to avoid an empty table).
  function clearEntry(index: number) {
    if (isBoxWhisker) {
      setBoxWhiskerData((prev) =>
        prev.map((entry, i) => (i === index ? defaultBoxWhiskerEntry() : entry)),
      );
    } else if (isScatter) {
      setScatterData((prev) => prev.map((entry, i) => (i === index ? defaultScatterEntry() : entry)));
    } else {
      setCategoricalData((prev) =>
        prev.map((entry, i) => (i === index ? defaultCategoricalEntry(index) : entry)),
      );
    }
  }

  function toggleSelected(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // Batch delete actually REMOVES the selected rows (splicing them out of
  // the array), unlike the per-row × button which only clears a single
  // row's contents in place — a deliberate, separate action for trimming
  // down an oversized data set (e.g. after importing 20 rows and wanting
  // to drop several at once), rather than the "reset one cell" use case
  // the × button covers.
  function deleteSelected() {
    if (isBoxWhisker) {
      setBoxWhiskerData((prev) => prev.filter((_, i) => !selectedIndices.has(i)));
    } else {
      setCategoricalData((prev) => prev.filter((_, i) => !selectedIndices.has(i)));
    }
    setSelectedIndices(new Set());
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
      let importedCount = 0;
      if (isBoxWhisker) {
        const entries = await parseBoxWhiskerSpreadsheet(file);
        importedCount = entries.length;
        setBoxWhiskerData(entries.length > 0 ? entries : [defaultBoxWhiskerEntry()]);
      } else if (isScatter) {
        const points = await parseScatterSpreadsheet(file);
        importedCount = points.length;
        setScatterData(
          points.length > 0
            ? points.map((p) => ({ x: String(p.x), y: String(p.y) }))
            : [defaultScatterEntry()],
        );
      } else {
        const entries = await parseCategoricalSpreadsheet(file);
        importedCount = entries.length;
        setCategoricalData(entries.length > 0 ? entries : [defaultCategoricalEntry(0)]);
      }
      setShowAllRows(false);
      setImportError(null);
      setImportedFileName(file.name);
      setSelectedIndices(new Set());
      // Warn (not block) once the import brings in enough entries that the
      // chart's own size clamp (anvilnote-charts's MAX_SCALED_DIMENSION)
      // starts compressing bar/box width instead of growing with count —
      // an import is the realistic path for crossing this in one action,
      // vs. typing entries in one at a time. Doesn't apply to scatter:
      // points don't get proportionally narrower/compressed the way
      // bars/boxes do, and a large point count (up to SCATTER_MAX_ENTRIES,
      // 200) is the NORMAL expected use case for a real data sample, not
      // a crowding problem worth warning about.
      if (!isScatter && importedCount > CROWDED_ENTRY_THRESHOLD) {
        toast.warning(t("tooManyEntriesWarning"));
      }
    } catch {
      setImportError(t("importError"));
    }
  }

  // Shared by both the compact grid (sliced to VISIBLE_ROW_LIMIT) and the
  // expanded full-table view (all rows) — only the row list passed in
  // differs; everything else (columns shown, update/clear handlers,
  // color popover) is identical between the two.
  function renderTable(
    catRows: typeof categoricalRows,
    boxRows: typeof boxWhiskerRows,
    options?: { scrollable?: boolean },
  ): ReactNode {
    return (
      <div className="flex flex-col gap-1.5">
        <div
          className={`overflow-x-auto ${options?.scrollable ? "max-h-[420px] overflow-y-auto" : ""}`}
        >
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
              <th className="border-b p-1.5 text-center" style={{ width: "6%" }}>
                <input
                  aria-label={t("selectAll")}
                  checked={
                    (isBoxWhisker ? boxRows.length : catRows.length) > 0 &&
                    (isBoxWhisker ? boxRows : catRows).every(({ index }) => selectedIndices.has(index))
                  }
                  onChange={(event) => {
                    const rows = isBoxWhisker ? boxRows : catRows;
                    setSelectedIndices((prev) => {
                      const next = new Set(prev);
                      for (const { index } of rows) {
                        if (event.target.checked) next.add(index);
                        else next.delete(index);
                      }
                      return next;
                    });
                  }}
                  type="checkbox"
                />
              </th>
              <th
                className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                style={{ width: isBoxWhisker ? "19%" : "39%" }}
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
              ? boxRows.map(({ entry, index }) => (
                  <tr key={index}>
                    <td className="border-b p-1.5 text-center">
                      <input
                        aria-label={t("selectRow")}
                        checked={selectedIndices.has(index)}
                        onChange={() => toggleSelected(index)}
                        type="checkbox"
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) => updateBoxWhiskerEntry(index, { label: event.target.value })}
                        value={entry.label}
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) =>
                          updateBoxWhiskerEntry(index, { min: parseNumericInput(event.target.value) })
                        }
                        type="number"
                        value={numericInputValue(entry.min)}
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) =>
                          updateBoxWhiskerEntry(index, { q1: parseNumericInput(event.target.value) })
                        }
                        type="number"
                        value={numericInputValue(entry.q1)}
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) =>
                          updateBoxWhiskerEntry(index, {
                            median: parseNumericInput(event.target.value),
                          })
                        }
                        type="number"
                        value={numericInputValue(entry.median)}
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) =>
                          updateBoxWhiskerEntry(index, { q3: parseNumericInput(event.target.value) })
                        }
                        type="number"
                        value={numericInputValue(entry.q3)}
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) =>
                          updateBoxWhiskerEntry(index, { max: parseNumericInput(event.target.value) })
                        }
                        type="number"
                        value={numericInputValue(entry.max)}
                      />
                    </td>
                    <td className="border-b border-l p-1 text-center">
                      <button
                        aria-label={t("clearEntry")}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => clearEntry(index)}
                        type="button"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              : catRows.map(({ entry, index }) => (
                  <tr key={index}>
                    <td className="border-b p-1.5 text-center">
                      <input
                        aria-label={t("selectRow")}
                        checked={selectedIndices.has(index)}
                        onChange={() => toggleSelected(index)}
                        type="checkbox"
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) => updateCategoricalEntry(index, { label: event.target.value })}
                        value={entry.label}
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) =>
                          updateCategoricalEntry(index, {
                            value: parseNumericInput(event.target.value),
                          })
                        }
                        type="number"
                        value={numericInputValue(entry.value)}
                      />
                    </td>
                    <td className="border-b border-l p-0">
                      <Popover
                        onOpenChange={(open) => setOpenColorRow(open ? index : null)}
                        open={openColorRow === index}
                      >
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
                        <PopoverContent className="w-64" onMouseDown={(event) => event.stopPropagation()}>
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
                      <button
                        aria-label={t("clearEntry")}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => clearEntry(index)}
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
        {selectedIndices.size > 0 ? (
          <div className="flex items-center gap-2 p-1.5">
            <span className="text-xs text-muted-foreground">
              {t("selectedCount", { count: selectedIndices.size })}
            </span>
            <Button onClick={deleteSelected} size="sm" variant="destructive">
              {t("deleteSelected")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  // Scatter's own simpler x/y-only table (no color/checkbox columns — a
  // scatter point has neither a per-point color override nor a batch-
  // select use case the other chart types' larger row counts justify).
  // Shared by both the compact grid and the expanded full-table view,
  // same "only the row list passed in differs" pattern as renderTable
  // above — this was previously inlined ONLY in the compact view, so the
  // expanded "Show more" view fell through to rendering categoricalRows/
  // boxWhiskerRows instead (irrelevant blank scaffolding for a scatter
  // chart), making the expanded view look empty. Real bug, caught live.
  function renderScatterTable(rows: typeof scatterRows, options?: { scrollable?: boolean }): ReactNode {
    return (
      <div className={options?.scrollable ? "max-h-[420px] overflow-x-auto overflow-y-auto" : "overflow-x-auto"}>
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              {/* Header text mirrors the xLabel/yLabel fields below
                  (falling back to plain "x"/"y" when empty) — so renaming
                  an axis there is immediately reflected here too, per
                  explicit feedback. */}
              <th className="border-b p-1.5 text-left text-xs font-medium text-muted-foreground">
                {xLabel.trim() || "x"}
              </th>
              <th className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground">
                {yLabel.trim() || "y"}
              </th>
              <th className="border-b border-l p-1.5" style={{ width: "10%" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, index }) => (
              <tr key={index}>
                <td className="border-b p-0">
                  <input
                    className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                    onChange={(event) => updateScatterEntry(index, { x: event.target.value })}
                    type="number"
                    value={entry.x}
                  />
                </td>
                <td className="border-b border-l p-0">
                  <input
                    className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                    onChange={(event) => updateScatterEntry(index, { y: event.target.value })}
                    type="number"
                    value={entry.y}
                  />
                </td>
                <td className="border-b border-l p-1.5 text-center">
                  <button
                    aria-label={t("clearEntry")}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => clearEntry(index)}
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
    );
  }

  return (
    <DialogContent className="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
      </DialogHeader>
      {showAllRows ? (
        // Expanded full-table view: replaces the normal two-column layout
        // (grid + chart preview) with a single scrollable table showing
        // EVERY row, not just VISIBLE_ROW_LIMIT — a fixed max-height with
        // its own scrollbar keeps the modal itself from growing to fit
        // potentially MAX_ENTRIES (20) rows. "Back" returns to the normal
        // compact view; Save/Cancel stay available in the footer below,
        // unchanged.
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              aria-label={t("backToChart")}
              className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setShowAllRows(false)}
              type="button"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <p className="text-sm font-medium">{t("dataViewTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {importedFileName ?? t("manualEntryLabel")}
              </p>
            </div>
          </div>
          {isScatter
            ? renderScatterTable(scatterRows, { scrollable: true })
            : renderTable(categoricalRows, boxWhiskerRows, { scrollable: true })}
        </div>
      ) : (
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
                    // Switching groups can switch which underlying dataset
                    // is active (categorical vs. box-whisker), so any
                    // selected row indices from the PREVIOUS dataset no
                    // longer make sense against the new one.
                    setSelectedIndices(new Set());
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
                <td> borders themselves form the grid lines. Scatter gets
                its own simpler x/y-only table (no color/checkbox columns —
                a scatter point has neither a per-point color override nor
                a batch-select use case the other chart types' larger row
                counts justify). */}
            {isScatter
              ? renderScatterTable(visibleScatterRows)
              : renderTable(visibleCategoricalRows, visibleBoxWhiskerRows)}

            {hiddenRowCount > 0 ? (
              <Button onClick={() => setShowAllRows(true)} size="sm" variant="ghost">
                {t("showMoreRows", { count: hiddenRowCount })}
              </Button>
            ) : null}

            <Button
              disabled={
                isScatter ? scatterData.length >= SCATTER_MAX_ENTRIES : activeData.length >= MAX_ENTRIES
              }
              onClick={addEntry}
              size="sm"
              variant="outline"
            >
              {(isScatter ? scatterData.length >= SCATTER_MAX_ENTRIES : activeData.length >= MAX_ENTRIES)
                ? t("entryLimitReached")
                : t("addEntry")}
            </Button>

            {chartType === "scatter" ? (
              // Trend line + its color picker + x/y axis label inputs all
              // share one row here (scatter only) — per explicit feedback
              // that the x/y label inputs should sit to the right of the
              // trend-line select rather than on their own separate rows
              // below (bar/column/line still get their own rows via the
              // generic block further down, since only scatter's layout
              // was called out).
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{t("trendLine")}</span>
                <Select onValueChange={(value) => setTrendLine(value as TrendLine)} value={trendLine}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("trendLineKinds.none")}</SelectItem>
                    <SelectItem value="linear">{t("trendLineKinds.linear")}</SelectItem>
                    <SelectItem value="lowess">{t("trendLineKinds.lowess")}</SelectItem>
                  </SelectContent>
                </Select>
                {trendLine !== "none" ? (
                  <Popover onOpenChange={setTrendLineColorOpen} open={trendLineColorOpen}>
                    <PopoverTrigger asChild>
                      <button
                        aria-label={t("trendLineColor")}
                        className="flex items-center gap-1.5 rounded border px-2 py-1 hover:bg-accent"
                        type="button"
                      >
                        <span
                          className="size-4 shrink-0 rounded-sm border"
                          style={{ backgroundColor: trendLineColor }}
                        />
                        <span className="font-mono text-xs text-muted-foreground">{trendLineColor}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <ColorPicker
                        className="gap-3"
                        onChange={(rgba) => {
                          const [r, g, b] = rgba as [number, number, number, number];
                          const hex = `#${[r, g, b]
                            .map((c) => Math.round(c).toString(16).padStart(2, "0"))
                            .join("")}`;
                          setTrendLineColor(hex);
                        }}
                        value={trendLineColor}
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
                ) : null}
                <label className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("xLabel")}</span>
                  <input
                    className="w-28 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:bg-accent"
                    onChange={(event) => setXLabel(event.target.value)}
                    value={xLabel}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("yLabel")}</span>
                  <input
                    className="w-28 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:bg-accent"
                    onChange={(event) => setYLabel(event.target.value)}
                    value={yLabel}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={yLabelRotated} onCheckedChange={setYLabelRotated} />
                  {t("yLabelRotated")}
                </label>
              </div>
            ) : null}

            {chartType === "bar" || chartType === "column" || chartType === "line" ? (
              <>
                <label className="flex items-center gap-1.5 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{t("xLabel")}</span>
                  <input
                    className="flex-1 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:bg-accent"
                    onChange={(event) => setXLabel(event.target.value)}
                    value={xLabel}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{t("yLabel")}</span>
                  <input
                    className="flex-1 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:bg-accent"
                    onChange={(event) => setYLabel(event.target.value)}
                    value={yLabel}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={yLabelRotated} onCheckedChange={setYLabelRotated} />
                  {t("yLabelRotated")}
                </label>
              </>
            ) : null}

            {chartType === "bar" || chartType === "column" || chartType === "scatter" ? (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showGridLines} onCheckedChange={setShowGridLines} />
                {t("showGridLines")}
              </label>
            ) : null}

            {chartType === "pie" ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={showLegend} onCheckedChange={setShowLegend} />
                  {t("showLegend")}
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span>{t("showPercentage")}</span>
                  <Select
                    onValueChange={(value) => setShowPercentage(value as PercentagePlacement)}
                    value={showPercentage}
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("percentagePlacement.none")}</SelectItem>
                      <SelectItem value="onSlice">{t("percentagePlacement.onSlice")}</SelectItem>
                      <SelectItem value="beside">{t("percentagePlacement.beside")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            {chartType === "bar" || chartType === "column" ? (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showValues} onCheckedChange={setShowValues} />
                {t("showValues")}
              </label>
            ) : null}
          </div>
          <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-2 overflow-hidden rounded border p-2">
            <Select onValueChange={(value) => setFontFamily(value as FontFamily)} value={fontFamily}>
              <SelectTrigger className="absolute top-2 right-2 z-10 h-7 w-28 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">{t("fontFamilies.sans")}</SelectItem>
                <SelectItem value="serif">{t("fontFamilies.serif")}</SelectItem>
              </SelectContent>
            </Select>
            {/* [&_svg]:max-w-full guards against a chart whose intrinsic
                size (set by anvilnote-charts's own scaledDimension, clamped
                but still capable of being wider than this pane at many
                entries) would otherwise overflow this fixed-size preview
                box — the SVG scales down to fit instead. */}
            {isPreviewCurrent && previewSvg ? (
              <div
                className="[&_svg]:h-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            ) : hasLabel && loading ? (
              <span className="text-muted-foreground text-sm">{t("previewLoading")}</span>
            ) : null}
            {hasLabel && error ? <p className="text-destructive text-sm">{t("previewError")}</p> : null}
          </div>
        </div>
      )}
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
