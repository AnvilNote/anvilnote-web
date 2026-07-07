import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { StatsChartNodeView } from "@/components/editor/node-views/stats-chart-node-view";
import { VISIBLE_ROW_LIMIT, defaultEntryColor, type ChartType } from "@/lib/stats-chart-defaults";

export type CategoricalEntry = { label: string; value: number; color?: string };
export type BoxWhiskerEntry = {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};
// Scatter's own point shape — a genuine numeric (x, y) pair, NOT
// categorical's (label, value); see anvilnote-charts's own
// scatterEntrySchema comment.
export type ScatterEntry = { x: number; y: number };

// Where (if at all) a pie's slice percentages are shown — mirrors
// anvilnote-charts's own schema enum. "onSlice" renders the percentage
// directly on the slice; "beside" appends it to the label text next to
// the slice; "none" shows neither.
export type PercentagePlacement = "none" | "onSlice" | "beside";

// Chart-wide text font — mirrors anvilnote-charts's own fontFamilySchema.
export type FontFamily = "sans" | "serif";

// Custom axis label text + rotation, shared by bar/column/line/scatter —
// mirrors anvilnote-charts's own axisLabelFields.
export type AxisLabelFields = { xLabel: string; yLabel: string; yLabelRotated: boolean };

// Where (if at all) a scatter plot's trend line is drawn — mirrors
// anvilnote-charts's own TREND_LINE_KINDS.
export type TrendLine = "none" | "linear" | "lowess";

export type StatsChartSpec =
  | ({ chartType: "bar"; data: CategoricalEntry[]; showValues: boolean; showGridLines: boolean; fontFamily: FontFamily } & AxisLabelFields)
  | ({ chartType: "column"; data: CategoricalEntry[]; showValues: boolean; showGridLines: boolean; fontFamily: FontFamily } & AxisLabelFields)
  | ({ chartType: "line"; data: CategoricalEntry[]; fontFamily: FontFamily } & AxisLabelFields)
  | ({ chartType: "scatter"; data: ScatterEntry[]; fontFamily: FontFamily; trendLine: TrendLine } & AxisLabelFields)
  | {
      chartType: "pie";
      data: CategoricalEntry[];
      showLegend: boolean;
      showPercentage: PercentagePlacement;
      fontFamily: FontFamily;
    }
  | { chartType: "boxwhisker"; data: BoxWhiskerEntry[]; fontFamily: FontFamily };

// Starts a freshly-inserted node with VISIBLE_ROW_LIMIT (10) empty rows,
// not just 1 — per explicit feedback, so a user filling in several
// entries doesn't have to click "Add entry" repeatedly first. Blank
// rows left over are filtered out by the dialog before saving/rendering
// (see stats-chart-dialog.tsx's buildSpec), so unfilled trailing rows
// never reach the API as invalid empty-label entries.
function defaultCategoricalData(): CategoricalEntry[] {
  return Array.from({ length: VISIBLE_ROW_LIMIT }, (_, index) => ({
    label: "",
    value: 0,
    color: defaultEntryColor(index),
  }));
}

function defaultBoxWhiskerData(): BoxWhiskerEntry[] {
  return Array.from({ length: VISIBLE_ROW_LIMIT }, () => ({
    label: "",
    min: 0,
    q1: 0,
    median: 0,
    q3: 0,
    max: 0,
  }));
}

// Scatter has no per-entry label, so a "blank" row is just a (0, 0)
// point rather than an empty-string sentinel — see stats-chart-dialog.tsx's
// own hasLabel-equivalent gating for scatter (checks entry count, not
// blank labels, since there's no label to check).
function defaultScatterData(): ScatterEntry[] {
  return Array.from({ length: VISIBLE_ROW_LIMIT }, () => ({ x: 0, y: 0 }));
}

function parseData(
  value: string | null,
  chartType: ChartType,
): CategoricalEntry[] | BoxWhiskerEntry[] | ScatterEntry[] {
  const fallback =
    chartType === "boxwhisker"
      ? defaultBoxWhiskerData()
      : chartType === "scatter"
        ? defaultScatterData()
        : defaultCategoricalData();
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const AnvilStatsChart = Node.create({
  name: "statsChart",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chartType: {
        // "column" (vertical bars), not "bar" (horizontal) — per explicit
        // feedback, a freshly-inserted bar chart should default to
        // vertical, with horizontal available via the dialog's orientation
        // toggle.
        default: "column",
        parseHTML: (element) => element.getAttribute("data-chart-type") ?? "column",
        renderHTML: (attributes) => ({ "data-chart-type": attributes.chartType ?? "column" }),
      },
      data: {
        default: defaultCategoricalData(),
        parseHTML: (element) =>
          parseData(
            element.getAttribute("data-entries"),
            (element.getAttribute("data-chart-type") as ChartType) ?? "column",
          ),
        renderHTML: (attributes) => ({ "data-entries": JSON.stringify(attributes.data ?? []) }),
      },
      showLegend: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-show-legend") !== "false",
        renderHTML: (attributes) => ({
          "data-show-legend": String(attributes.showLegend ?? true),
        }),
      },
      // bar/column only — prints each bar's own value above/beside it.
      showValues: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-show-values") === "true",
        renderHTML: (attributes) => ({
          "data-show-values": String(attributes.showValues ?? false),
        }),
      },
      // pie only — where (if at all) slice percentages are shown; see
      // PercentagePlacement above.
      showPercentage: {
        default: "none",
        parseHTML: (element) => element.getAttribute("data-show-percentage") ?? "none",
        renderHTML: (attributes) => ({
          "data-show-percentage": attributes.showPercentage ?? "none",
        }),
      },
      // bar/column only — the value axis's own reference gridlines.
      showGridLines: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-show-grid-lines") !== "false",
        renderHTML: (attributes) => ({
          "data-show-grid-lines": String(attributes.showGridLines ?? true),
        }),
      },
      // bar/column/line/scatter only; see AxisLabelFields above.
      xLabel: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-x-label") ?? "",
        renderHTML: (attributes) => ({ "data-x-label": attributes.xLabel ?? "" }),
      },
      yLabel: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-y-label") ?? "",
        renderHTML: (attributes) => ({ "data-y-label": attributes.yLabel ?? "" }),
      },
      yLabelRotated: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-y-label-rotated") !== "false",
        renderHTML: (attributes) => ({
          "data-y-label-rotated": String(attributes.yLabelRotated ?? true),
        }),
      },
      // scatter only; see TrendLine above.
      trendLine: {
        default: "none",
        parseHTML: (element) => element.getAttribute("data-trend-line") ?? "none",
        renderHTML: (attributes) => ({ "data-trend-line": attributes.trendLine ?? "none" }),
      },
      // Chart-wide; see FontFamily above.
      fontFamily: {
        default: "sans",
        parseHTML: (element) => element.getAttribute("data-font-family") ?? "sans",
        renderHTML: (attributes) => ({
          "data-font-family": attributes.fontFamily ?? "sans",
        }),
      },
      svg: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-svg"),
        renderHTML: (attributes) => (attributes.svg ? { "data-svg": attributes.svg } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="stats-chart"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "stats-chart" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StatsChartNodeView);
  },
});

export function insertStatsChart(editor: Editor) {
  editor.chain().focus().insertContent({ type: "statsChart" }).run();
}
