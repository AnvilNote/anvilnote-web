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
import { InlineMathText } from "@/components/editor/inline-math-text";
import {
  CHART_TYPE_GROUPS,
  CROWDED_ENTRY_THRESHOLD,
  MAX_ENTRIES,
  MAX_SERIES,
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
  parseStackedSpreadsheet,
} from "@/lib/stats-chart-import";
import { parseNumericInput, numericInputValue } from "@/lib/numeric-input";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/templates";
import type {
  BoxWhiskerEntry,
  CategoricalEntry,
  FontFamily,
  PercentagePlacement,
  StatsChartSpec,
  StackedEntry,
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

function defaultStackedEntry(seriesCount: number): StackedEntry {
  return { label: "", values: Array.from({ length: seriesCount }, () => 0) };
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

function padStackedData(data: StackedEntry[], seriesCount: number): StackedEntry[] {
  const normalized = data.map((entry) => ({
    ...entry,
    values: Array.from({ length: seriesCount }, (_, index) => entry.values[index] ?? 0),
  }));
  if (normalized.length >= VISIBLE_ROW_LIMIT) return normalized;
  const padding = Array.from({ length: VISIBLE_ROW_LIMIT - normalized.length }, () =>
    defaultStackedEntry(seriesCount),
  );
  return [...normalized, ...padding];
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
  // LIVE version (tracks chartType state, recomputed every render) — used
  // by JSX conditions further down so switching chart type mid-session
  // (e.g. bar -> pie) immediately hides/shows the right fields. See
  // hadAxisLabelFieldsAtMount below for the separate frozen-at-mount
  // version state initializers need instead.
  const hasAxisLabelFields =
    chartType === "bar" ||
    chartType === "column" ||
    chartType === "stackedBar" ||
    chartType === "stackedColumn" ||
    chartType === "line" ||
    chartType === "scatter";
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
    initialSpec.chartType === "bar" ||
      initialSpec.chartType === "column" ||
      initialSpec.chartType === "pie" ||
      initialSpec.chartType === "line"
      ? padCategoricalData(initialSpec.data)
      : Array.from({ length: VISIBLE_ROW_LIMIT }, (_, index) => defaultCategoricalEntry(index)),
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
  const initialStackedSeriesLabels =
    initialSpec.chartType === "stackedBar" || initialSpec.chartType === "stackedColumn"
      ? initialSpec.seriesLabels
      : ["Series 1", "Series 2"];
  const [stackedData, setStackedData] = useState<StackedEntry[]>(
    initialSpec.chartType === "stackedBar" || initialSpec.chartType === "stackedColumn"
      ? padStackedData(initialSpec.data, initialStackedSeriesLabels.length)
      : Array.from({ length: VISIBLE_ROW_LIMIT }, () =>
        defaultStackedEntry(initialStackedSeriesLabels.length),
      ),
  );
  const [seriesLabels, setSeriesLabels] = useState<string[]>(initialStackedSeriesLabels);
  const [seriesColors, setSeriesColors] = useState<string[]>(
    initialSpec.chartType === "stackedBar" || initialSpec.chartType === "stackedColumn"
      ? initialSpec.seriesColors ?? initialStackedSeriesLabels.map((_, index) => defaultEntryColor(index))
      : initialStackedSeriesLabels.map((_, index) => defaultEntryColor(index)),
  );
  const [showLegend, setShowLegend] = useState(
    initialSpec.chartType === "pie" ||
      initialSpec.chartType === "stackedBar" ||
      initialSpec.chartType === "stackedColumn"
      ? initialSpec.showLegend
      : true,
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
      initialSpec.chartType === "stackedBar" ||
      initialSpec.chartType === "stackedColumn" ||
      initialSpec.chartType === "scatter"
      ? initialSpec.showGridLines
      : true,
  );
  const [showBorder, setShowBorder] = useState(
    initialSpec.chartType === "bar" ||
      initialSpec.chartType === "column" ||
      initialSpec.chartType === "stackedBar" ||
      initialSpec.chartType === "stackedColumn"
      ? initialSpec.showBorder
      : true,
  );
  // Width is set as a PERCENTAGE of the current template's own text-column
  // width (textWidthCm), not a literal cm value — per explicit feedback,
  // since a fixed cm number means something different on every template
  // (each has its own page margins/width). Height stays a literal cm
  // value. Looked up from the currently active document's own template
  // (Zustand stores, not React context — works the same whether this
  // dialog is rendered deep inside a NodeView or not); falls back to
  // DEFAULT_TEMPLATE_ID's own width if no document is active yet (e.g. a
  // detached/preview render context), and 16cm (the most common template
  // value) if even that template lookup somehow misses.
  const activeDocumentId = useDocumentStore((s) => s.activeId);
  const activeDocument = useDocumentStore((s) => s.documents.find((d) => d.id === activeDocumentId));
  const activeTemplate = useTemplatesStore((s) =>
    s.getTemplate(activeDocument?.templateId ?? DEFAULT_TEMPLATE_ID),
  );
  const textWidthCm = activeTemplate?.textWidthCm ?? 16;

  // Draft string (not a number) — same "blank means unset, not some
  // sentinel number" pattern as scatter's own draft entries: an empty
  // input means "auto" (no override sent), not 0. Every chart type's
  // spec now carries width (CustomSizeFields spread into the whole
  // StatsChartSpec union), so no chartType narrowing is needed here
  // unlike most other per-type state above.
  //
  // height is intentionally NOT a user-facing field at all (per explicit
  // feedback simplifying this down to one control) — it's left unset in
  // the spec, so anvilnote-charts's own auto-computed height (scaled to
  // entry count, matching its existing non-custom-size behavior) applies
  // regardless of what width ratio is chosen.
  const [widthRatioDraft, setWidthRatioDraft] = useState(
    initialSpec.width !== undefined ? String(Math.round((initialSpec.width / textWidthCm) * 100)) : "",
  );
  // Deliberately reads initialSpec here (frozen at mount), NOT the live
  // chartType state below — these three useState initializers only run
  // once, at mount, so they only ever need "was axis-label data present
  // in the spec this dialog opened with". The JSX conditions further
  // down need the LIVE version instead (see hasAxisLabelFields), since a
  // user switching chart type mid-session (e.g. bar -> pie) must
  // immediately stop seeing bar-only fields like "Rotate vertical axis" —
  // confirmed as a real bug via a live screenshot: switching to Pie kept
  // showing Rotate vertical axis because this used to be one shared
  // frozen boolean for both purposes.
  const hadAxisLabelFieldsAtMount =
    initialSpec.chartType === "bar" ||
    initialSpec.chartType === "column" ||
    initialSpec.chartType === "stackedBar" ||
    initialSpec.chartType === "stackedColumn" ||
    initialSpec.chartType === "line" ||
    initialSpec.chartType === "scatter";
  const [xLabel, setXLabel] = useState(hadAxisLabelFieldsAtMount ? initialSpec.xLabel : "");
  const [yLabel, setYLabel] = useState(hadAxisLabelFieldsAtMount ? initialSpec.yLabel : "");
  const [yLabelRotated, setYLabelRotated] = useState(
    hadAxisLabelFieldsAtMount ? initialSpec.yLabelRotated : true,
  );
  const [trendLine, setTrendLine] = useState<TrendLine>(
    initialSpec.chartType === "scatter" ? initialSpec.trendLine : "none",
  );
  const [trendLineColor, setTrendLineColor] = useState(
    initialSpec.chartType === "scatter" ? initialSpec.trendLineColor : "#E3120B",
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
  const isStacked = chartType === "stackedBar" || chartType === "stackedColumn";
  const activeData = isBoxWhisker ? boxWhiskerData : isStacked ? stackedData : categoricalData;
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
  const stackedRows = stackedData.map((entry, index) => ({ entry, index }));
  const visibleCategoricalRows = showAllRows
    ? categoricalRows
    : categoricalRows.slice(0, VISIBLE_ROW_LIMIT);
  const visibleBoxWhiskerRows = showAllRows ? boxWhiskerRows : boxWhiskerRows.slice(0, VISIBLE_ROW_LIMIT);
  const visibleScatterRows = showAllRows ? scatterRows : scatterRows.slice(0, VISIBLE_ROW_LIMIT);
  const visibleStackedRows = showAllRows ? stackedRows : stackedRows.slice(0, VISIBLE_ROW_LIMIT);
  const hiddenRowCount = isScatter
    ? scatterData.length - Math.min(scatterData.length, VISIBLE_ROW_LIMIT)
    : activeData.length - Math.min(activeData.length, VISIBLE_ROW_LIMIT);

  // Blank draft = "auto" (no override sent) — the schema's own width is
  // optional, so `undefined` here means the field is simply omitted from
  // the spec, letting anvilnote-charts fall back to its usual
  // auto-computed dimension. width is stored as a PERCENTAGE of the
  // template's own textWidthCm (see widthRatioDraft's own comment above)
  // and converted to an absolute cm value here, right before it goes
  // into the spec — anvilnote-charts/anvilnote-api's own schemas are
  // unchanged, still plain cm; the ratio is a web-only input mode.
  // height is never set from here at all — see widthRatioDraft's comment
  // on why it's not a user-facing field.
  function customSize(): { width?: number } {
    const widthRatio = widthRatioDraft.trim() ? Number(widthRatioDraft) : undefined;
    const width =
      widthRatio !== undefined && Number.isFinite(widthRatio)
        ? Math.round(((widthRatio / 100) * textWidthCm) * 100) / 100
        : undefined;
    return { width };
  }

  function buildSpec(): StatsChartSpec {
    // Rows with a blank label are filtered out here, not just left in —
    // a freshly-inserted node starts with VISIBLE_ROW_LIMIT (5) empty
    // rows (see stats-chart.ts's defaultCategoricalData/
    // defaultBoxWhiskerData), and the API's per-entry schema requires a
    // non-empty label, so any trailing unfilled rows would otherwise fail
    // validation the moment the user has typed into even one earlier row.
    if (chartType === "boxwhisker") {
      return {
        chartType,
        data: boxWhiskerData.filter((entry) => entry.label.trim()),
        fontFamily,
        ...customSize(),
      };
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
        ...customSize(),
      };
    }
    if (chartType === "stackedBar" || chartType === "stackedColumn") {
      const cleanSeriesLabels = seriesLabels.map((label, index) => label.trim() || `Series ${index + 1}`);
      const cleanSeriesColors = cleanSeriesLabels.map((_, index) => seriesColors[index] ?? defaultEntryColor(index));
      return {
        chartType,
        data: stackedData
          .filter((entry) => entry.label.trim())
          .map((entry) => ({
            label: entry.label,
            values: cleanSeriesLabels.map((_, index) => entry.values[index] ?? 0),
          })),
        seriesLabels: cleanSeriesLabels,
        seriesColors: cleanSeriesColors,
        showLegend,
        showGridLines,
        showBorder,
        fontFamily,
        xLabel,
        yLabel,
        yLabelRotated,
        ...customSize(),
      };
    }
    const filteredData = categoricalData.filter((entry) => entry.label.trim());
    if (chartType === "pie") {
      return { chartType, data: filteredData, showLegend, showPercentage, fontFamily, ...customSize() };
    }
    if (chartType === "line") {
      return { chartType, data: filteredData, fontFamily, xLabel, yLabel, yLabelRotated, ...customSize() };
    }
    return {
      chartType,
      data: filteredData,
      showValues,
      showGridLines,
      showBorder,
      fontFamily,
      xLabel,
      yLabel,
      yLabelRotated,
      ...customSize(),
    };
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

  function updateStackedEntry(index: number, patch: Partial<StackedEntry>) {
    setStackedData((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function updateStackedValue(rowIndex: number, seriesIndex: number, value: number) {
    setStackedData((prev) =>
      prev.map((entry, i) =>
        i === rowIndex
          ? {
            ...entry,
            values: entry.values.map((existing, j) => (j === seriesIndex ? value : existing)),
          }
          : entry,
      ),
    );
  }

  function updateSeriesLabel(index: number, label: string) {
    setSeriesLabels((prev) => prev.map((existing, i) => (i === index ? label : existing)));
  }

  // Mirrors anvilnote-charts's own customSizeFields clamp (1-50cm) — the
  // RESOLVED cm value (ratio% × textWidthCm) is checked against this,
  // even though the user only ever types a percentage.
  const CUSTOM_SIZE_MIN = 1;
  const CUSTOM_SIZE_MAX = 50;

  function handleWidthRatioChange(value: string) {
    setWidthRatioDraft(value);
    if (!value.trim() || !Number.isFinite(Number(value))) return;
    const resolvedCm = (Number(value) / 100) * textWidthCm;
    if (resolvedCm < CUSTOM_SIZE_MIN || resolvedCm > CUSTOM_SIZE_MAX) {
      toast.warning(t("customSizeRangeWarning", { min: CUSTOM_SIZE_MIN, max: CUSTOM_SIZE_MAX }));
    }
  }

  function updateSeriesColor(index: number, color: string) {
    setSeriesColors((prev) => prev.map((existing, i) => (i === index ? color : existing)));
  }

  function addSeries() {
    setSeriesLabels((prev) => (prev.length >= MAX_SERIES ? prev : [...prev, `Series ${prev.length + 1}`]));
    setSeriesColors((prev) => (prev.length >= MAX_SERIES ? prev : [...prev, defaultEntryColor(prev.length)]));
    setStackedData((prev) =>
      seriesLabels.length >= MAX_SERIES
        ? prev
        : prev.map((entry) => ({ ...entry, values: [...entry.values, 0] })),
    );
  }

  function removeSeries(index: number) {
    if (seriesLabels.length <= 1) return;
    setSeriesLabels((prev) => prev.filter((_, i) => i !== index));
    setSeriesColors((prev) => prev.filter((_, i) => i !== index));
    setStackedData((prev) =>
      prev.map((entry) => ({ ...entry, values: entry.values.filter((_, i) => i !== index) })),
    );
  }

  function addEntry() {
    if (isBoxWhisker) {
      setBoxWhiskerData((prev) => (prev.length >= MAX_ENTRIES ? prev : [...prev, defaultBoxWhiskerEntry()]));
    } else if (isScatter) {
      setScatterData((prev) =>
        prev.length >= SCATTER_MAX_ENTRIES ? prev : [...prev, defaultScatterEntry()],
      );
    } else if (isStacked) {
      setStackedData((prev) =>
        prev.length >= MAX_ENTRIES ? prev : [...prev, defaultStackedEntry(seriesLabels.length)],
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
    } else if (isStacked) {
      setStackedData((prev) =>
        prev.map((entry, i) => (i === index ? defaultStackedEntry(seriesLabels.length) : entry)),
      );
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
    } else if (isStacked) {
      setStackedData((prev) => prev.filter((_, i) => !selectedIndices.has(i)));
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
        setBoxWhiskerData(padBoxWhiskerData(entries.length > 0 ? entries : [defaultBoxWhiskerEntry()]));
      } else if (isScatter) {
        const points = await parseScatterSpreadsheet(file);
        importedCount = points.length;
        setScatterData(
          points.length > 0
            ? points.map((p) => ({ x: String(p.x), y: String(p.y) }))
            : [defaultScatterEntry()],
        );
      } else if (isStacked) {
        const imported = await parseStackedSpreadsheet(file);
        importedCount = imported.data.length;
        setSeriesLabels(imported.seriesLabels);
        setSeriesColors(imported.seriesLabels.map((_, index) => defaultEntryColor(index)));
        setStackedData(
          padStackedData(
            imported.data.length > 0 ? imported.data : [defaultStackedEntry(imported.seriesLabels.length)],
            imported.seriesLabels.length,
          ),
        );
      } else {
        const entries = await parseCategoricalSpreadsheet(file);
        importedCount = entries.length;
        setCategoricalData(padCategoricalData(entries.length > 0 ? entries : [defaultCategoricalEntry(0)]));
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
                      <InlineMathText text={t("q1")} />
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
                      <InlineMathText text={t("q3")} />
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
              {/* Merged "Add entry" row — replaces the standalone Button
                  that used to sit below the whole table, per explicit
                  feedback putting it inside the grid itself as one more
                  (colspan) row right after the visible ones. Column count
                  differs: boxwhisker has 8 (checkbox/label/min/q1/median/
                  q3/max/remove), categorical has 5 (checkbox/label/value/
                  color/remove). */}
              <tr>
                <td className="border-b p-0" colSpan={isBoxWhisker ? 8 : 5}>
                  <button
                    className="w-full px-2 py-1.5 text-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    disabled={activeData.length >= MAX_ENTRIES}
                    onClick={addEntry}
                    type="button"
                  >
                    {activeData.length >= MAX_ENTRIES ? t("entryLimitReached") : t("addEntry")}
                  </button>
                </td>
              </tr>
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
            {/* Merged "Add entry" row — see renderTable's own comment on
                this same pattern. Scatter's own 3 columns: x/y/remove. */}
            <tr>
              <td className="border-b p-0" colSpan={3}>
                <button
                  className="w-full px-2 py-1.5 text-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  disabled={scatterData.length >= SCATTER_MAX_ENTRIES}
                  onClick={addEntry}
                  type="button"
                >
                  {scatterData.length >= SCATTER_MAX_ENTRIES ? t("entryLimitReached") : t("addEntry")}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function renderStackedTable(rows: typeof stackedRows, options?: { scrollable?: boolean }): ReactNode {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {seriesLabels.map((label, index) => (
            <div key={index} className="flex items-center gap-1 rounded border px-2 py-1">
              <input
                className="w-24 bg-transparent text-xs outline-none"
                onChange={(event) => updateSeriesLabel(index, event.target.value)}
                value={label}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label={t("seriesColor")}
                    className="size-4 rounded-sm border"
                    style={{ backgroundColor: seriesColors[index] ?? defaultEntryColor(index) }}
                    type="button"
                  />
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <ColorPicker
                    className="gap-3"
                    onChange={(rgba) => {
                      const [r, g, b] = rgba as [number, number, number, number];
                      const hex = `#${[r, g, b]
                        .map((c) => Math.round(c).toString(16).padStart(2, "0"))
                        .join("")}`;
                      updateSeriesColor(index, hex);
                    }}
                    value={seriesColors[index] ?? defaultEntryColor(index)}
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
              {seriesLabels.length > 1 ? (
                <button
                  aria-label={t("removeSeries")}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => removeSeries(index)}
                  type="button"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <Button
            disabled={seriesLabels.length >= MAX_SERIES}
            onClick={addSeries}
            size="sm"
            type="button"
            variant="outline"
          >
            {seriesLabels.length >= MAX_SERIES ? t("seriesLimitReached") : t("addSeries")}
          </Button>
        </div>
        <div className={options?.scrollable ? "max-h-[420px] overflow-x-auto overflow-y-auto" : "overflow-x-auto"}>
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="border-b p-1.5 text-center" style={{ width: "6%" }}>
                  <input
                    aria-label={t("selectAll")}
                    checked={rows.length > 0 && rows.every(({ index }) => selectedIndices.has(index))}
                    onChange={(event) => {
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
                <th className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground">
                  {t("label")}
                </th>
                {seriesLabels.map((label, index) => (
                  <th
                    className="border-b border-l p-1.5 text-left text-xs font-medium text-muted-foreground"
                    key={index}
                  >
                    {label.trim() || `Series ${index + 1}`}
                  </th>
                ))}
                <th className="border-b border-l p-1.5" style={{ width: "10%" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, index }) => (
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
                      onChange={(event) => updateStackedEntry(index, { label: event.target.value })}
                      value={entry.label}
                    />
                  </td>
                  {seriesLabels.map((_, seriesIndex) => (
                    <td className="border-b border-l p-0" key={seriesIndex}>
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none focus:bg-accent"
                        onChange={(event) =>
                          updateStackedValue(index, seriesIndex, parseNumericInput(event.target.value))
                        }
                        type="number"
                        value={numericInputValue(entry.values[seriesIndex] ?? 0)}
                      />
                    </td>
                  ))}
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
              {/* Merged "Add entry" row — see renderTable's own comment on
                  this same pattern. Stacked's column count is dynamic:
                  checkbox + label + one per series + remove. */}
              <tr>
                <td className="border-b p-0" colSpan={seriesLabels.length + 3}>
                  <button
                    className="w-full px-2 py-1.5 text-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    disabled={activeData.length >= MAX_ENTRIES}
                    onClick={addEntry}
                    type="button"
                  >
                    {activeData.length >= MAX_ENTRIES ? t("entryLimitReached") : t("addEntry")}
                  </button>
                </td>
              </tr>
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
            : isStacked
              ? renderStackedTable(stackedRows, { scrollable: true })
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
                    } else if (group === "stackedBar") {
                      setChartTypeRaw((prev) =>
                        prev === "stackedBar" || prev === "stackedColumn" ? prev : "stackedColumn",
                      );
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
              {chartTypeGroup(chartType) === "stackedBar" ? (
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <Switch
                    checked={chartType === "stackedBar"}
                    onCheckedChange={(checked) => setChartTypeRaw(checked ? "stackedBar" : "stackedColumn")}
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
              : isStacked
                ? renderStackedTable(visibleStackedRows)
                : renderTable(visibleCategoricalRows, visibleBoxWhiskerRows)}

            {hiddenRowCount > 0 ? (
              <Button onClick={() => setShowAllRows(true)} size="sm" variant="ghost">
                {t("showMoreRows", { count: hiddenRowCount })}
              </Button>
            ) : null}

            {chartType === "scatter" ? (
              // Trend line + its color picker get their own row (scatter
              // only) — separate from the x/y-label row and the rotate/
              // gridline row below, per explicit feedback reverting an
              // earlier "everything on one row" layout.
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{t("trendLine")}</span>
                <Select onValueChange={(value) => setTrendLine(value as TrendLine)} value={trendLine}>
                  <SelectTrigger className="h-8 w-28 text-xs">
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
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-accent"
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
              </div>
            ) : null}

            {/* showLegend AND showPercentage (pie only, both moved here
                from the left panel) now live in the preview pane's own
                top bar — see below. Nothing pie-specific left in the
                left panel anymore. */}
          </div>
          <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-2 overflow-hidden rounded border p-2">
            {/* Top bar: showGridLines/showBorder/showValues/serif toggle/
                yLabelRotated are all one bundled group now — per
                explicit feedback, NOT split left/right (that earlier
                justify-between layout implied two unrelated groups when
                they're really all the same kind of "chart display
                toggle"). All left-aligned, flex-wrap so it degrades to
                multiple lines on a narrower dialog instead of
                overflowing — applies equally regardless of how many of
                these render for the current chart type (fewer toggles
                just means a shorter first line, still left-aligned, not
                re-centered or spread out). Each toggle still only
                renders for the chart types it actually applies to
                (gridlines: bar/column/stacked/scatter; border: bar/
                column/stacked; values: bar/column only; yLabelRotated:
                whichever chart types have axis labels at all). */}
            <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {chartType === "bar" ||
                chartType === "column" ||
                chartType === "stackedBar" ||
                chartType === "stackedColumn" ||
                chartType === "scatter" ? (
                <label className="flex items-center gap-1.5">
                  <Switch checked={showGridLines} onCheckedChange={setShowGridLines} className="scale-90" />
                  {t("showGridLines")}
                </label>
              ) : null}
              {chartType === "bar" ||
                chartType === "column" ||
                chartType === "stackedBar" ||
                chartType === "stackedColumn" ? (
                <label className="flex items-center gap-1.5">
                  <Switch checked={showBorder} onCheckedChange={setShowBorder} className="scale-90" />
                  {t("showBorder")}
                </label>
              ) : null}
              {chartType === "bar" || chartType === "column" ? (
                <label className="flex items-center gap-1.5">
                  <Switch checked={showValues} onCheckedChange={setShowValues} className="scale-90" />
                  {t("showValues")}
                </label>
              ) : null}
              {chartType === "pie" || chartType === "stackedBar" || chartType === "stackedColumn" ? (
                <label className="flex items-center gap-1.5">
                  <Switch checked={showLegend} onCheckedChange={setShowLegend} className="scale-90" />
                  {t("showLegend")}
                </label>
              ) : null}
              <label className="flex items-center gap-1.5">
                <Switch
                  checked={fontFamily === "serif"}
                  onCheckedChange={(checked) => setFontFamily(checked ? "serif" : "sans")}
                  className="scale-90"
                />
                {t("useSerifFont")}
              </label>
              {chartType === "pie" ? (
                <>
                  {/* Switch (not checkbox) — corrected per explicit
                      feedback. checked = showPercentage !== "none".
                      Checking ON defaults to "onSlice" (arbitrary but
                      reasonable — matches the radio group's own first
                      option); unchecking snaps back to "none" outright
                      rather than remembering the prior placement. */}
                  <label className="flex items-center gap-1.5">
                    <Switch
                      checked={showPercentage !== "none"}
                      onCheckedChange={(checked) => setShowPercentage(checked ? "onSlice" : "none")}
                      className="scale-90"
                    />
                    {t("showPercentage")}
                  </label>
                  {/* Round radio buttons (not a Select dropdown) for the
                      onSlice/beside choice — corrected per explicit
                      feedback ("圓形的 checkbox" = radio). Native <input
                      type="radio"> renders as a circle by default. */}
                  {showPercentage !== "none" ? (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1">
                        <input
                          checked={showPercentage === "onSlice"}
                          className="size-3 accent-black"
                          name="percentagePlacement"
                          onChange={() => setShowPercentage("onSlice")}
                          type="radio"
                        />
                        {t("percentagePlacement.onSlice")}
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          checked={showPercentage === "beside"}
                          className="size-3 accent-black"
                          name="percentagePlacement"
                          onChange={() => setShowPercentage("beside")}
                          type="radio"
                        />
                        {t("percentagePlacement.beside")}
                      </label>
                    </div>
                  ) : null}
                </>
              ) : null}
              {hasAxisLabelFields ? (
                <label className="flex items-center gap-1.5">
                  <Switch checked={yLabelRotated} onCheckedChange={setYLabelRotated} className="scale-90" />
                  {t("yLabelRotated")}
                </label>
              ) : null}
            </div>
            {/* Deliberately shrunk well below the pane's own available
                space (70%/260px, not just barely-under-100%) — per
                explicit feedback that an earlier, more conservative crop
                (90%) still looked "just as big". object-contain scales
                the SVG down to fit BOTH axes while preserving its own
                aspect ratio; the flex parent's own items-center/
                justify-center centers this box both ways once it's no
                longer forced to stretch full-width. */}
            {isPreviewCurrent && previewSvg ? (
              <div
                // Fixed px max-height (not a %) since the pane's own
                // min-h-[420px] isn't a DEFINITE height — a percentage
                // height on this child wouldn't resolve against a
                // min-height parent, silently falling back to auto.
                className="flex max-h-[330px] w-full max-w-[100%] items-center justify-center [&_svg]:h-auto [&_svg]:max-h-[330px] [&_svg]:w-auto [&_svg]:max-w-full [&_svg]:object-contain"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            ) : hasLabel && loading ? (
              <span className="text-muted-foreground text-sm">{t("previewLoading")}</span>
            ) : null}
            {hasLabel && error ? <p className="text-destructive text-sm">{t("previewError")}</p> : null}
            {/* Bottom bar: xLabel/yLabel (moved here from the left panel)
                share one row with the width ratio input, at the same
                height — per explicit feedback. yLabelRotated moved to
                the TOP bar instead (next to the serif toggle), not here.
                The ratio input stays rightmost (justify-between keeps it
                pinned there regardless of how many left-hand fields
                render for the current chart type). */}
            <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {hasAxisLabelFields ? (
                  <>
                    <label className="flex items-center gap-1">
                      <span className="text-muted-foreground">{t("xLabel")}</span>
                      <input
                        className="w-20 rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                        onChange={(event) => setXLabel(event.target.value)}
                        value={xLabel}
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-muted-foreground">{t("yLabel")}</span>
                      <input
                        className="w-20 rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                        onChange={(event) => setYLabel(event.target.value)}
                        value={yLabel}
                      />
                    </label>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 bg-background/90 px-2 py-1">
                <input
                  aria-label={t("customWidthRatio")}
                  className="w-12 rounded-lg border bg-transparent px-1 py-0.5 text-center text-xs outline-none focus:bg-accent"
                  onChange={(event) => handleWidthRatioChange(event.target.value)}
                  placeholder={t("auto")}
                  type="number"
                  value={widthRatioDraft}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
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
