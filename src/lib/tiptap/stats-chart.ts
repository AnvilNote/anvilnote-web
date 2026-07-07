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
export type StackedEntry = { label: string; values: number[] };

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

// User-overridable chart dimensions (cm) — mirrors anvilnote-charts's own
// customSizeFields. Both optional and independent: either can be set
// without the other (the unset axis keeps its auto-computed size).
// Spread into every chart type's own spec shape below, including pie
// (maps to radius server-side) and boxwhisker (no AxisLabelFields, but
// still gets its own size).
export type CustomSizeFields = { width?: number; height?: number };

// Where (if at all) a scatter plot's trend line is drawn — mirrors
// anvilnote-charts's own TREND_LINE_KINDS.
export type TrendLine = "none" | "linear" | "lowess";

export type StatsChartSpec =
  | ({
      chartType: "bar";
      data: CategoricalEntry[];
      showValues: boolean;
      showGridLines: boolean;
      showBorder: boolean;
      fontFamily: FontFamily;
    } & AxisLabelFields &
      CustomSizeFields)
  | ({
      chartType: "column";
      data: CategoricalEntry[];
      showValues: boolean;
      showGridLines: boolean;
      showBorder: boolean;
      fontFamily: FontFamily;
    } & AxisLabelFields &
      CustomSizeFields)
  | ({
      chartType: "stackedBar" | "stackedColumn";
      data: StackedEntry[];
      seriesLabels: string[];
      seriesColors?: string[];
      showLegend: boolean;
      showGridLines: boolean;
      showBorder: boolean;
      fontFamily: FontFamily;
    } & AxisLabelFields &
      CustomSizeFields)
  | ({ chartType: "line"; data: CategoricalEntry[]; fontFamily: FontFamily } & AxisLabelFields & CustomSizeFields)
  | ({
      chartType: "scatter";
      data: ScatterEntry[];
      fontFamily: FontFamily;
      trendLine: TrendLine;
      trendLineColor: string;
      showGridLines: boolean;
    } & AxisLabelFields &
      CustomSizeFields)
  | ({
      chartType: "pie";
      data: CategoricalEntry[];
      showLegend: boolean;
      showPercentage: PercentagePlacement;
      fontFamily: FontFamily;
    } & CustomSizeFields)
  | ({ chartType: "boxwhisker"; data: BoxWhiskerEntry[]; fontFamily: FontFamily } & CustomSizeFields);

// Starts a freshly-inserted node with VISIBLE_ROW_LIMIT (5) empty rows,
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

function defaultStackedData(): StackedEntry[] {
  return Array.from({ length: VISIBLE_ROW_LIMIT }, () => ({ label: "", values: [0, 0] }));
}

function parseData(
  value: string | null,
  chartType: ChartType,
): CategoricalEntry[] | BoxWhiskerEntry[] | ScatterEntry[] | StackedEntry[] {
  const fallback =
    chartType === "boxwhisker"
      ? defaultBoxWhiskerData()
      : chartType === "scatter"
        ? defaultScatterData()
        : chartType === "stackedBar" || chartType === "stackedColumn"
          ? defaultStackedData()
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
      // stackedBar/stackedColumn only — real bug fix: this had no
      // parseHTML/renderHTML of its own, so updateAttributes's spread of
      // the full spec set it in-memory for the current editor session
      // only; a saved document's HTML never carried it, silently losing
      // every stacked chart's own series names on reload.
      seriesLabels: {
        default: [],
        parseHTML: (element) => {
          try {
            const parsed = JSON.parse(element.getAttribute("data-series-labels") ?? "[]");
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-series-labels": JSON.stringify(attributes.seriesLabels ?? []),
        }),
      },
      // stackedBar/stackedColumn only, optional — same persistence bug as
      // seriesLabels above. Omitted entirely (no data-series-colors
      // attribute rendered) when unset, matching build-typst.ts's own
      // "falls back to the default color cycle" behavior for an absent
      // seriesColors.
      seriesColors: {
        default: undefined,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-series-colors");
          if (!raw) return undefined;
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : undefined;
          } catch {
            return undefined;
          }
        },
        renderHTML: (attributes) =>
          attributes.seriesColors ? { "data-series-colors": JSON.stringify(attributes.seriesColors) } : {},
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
      // bar/column/stacked only — each bar/segment's own outline stroke.
      showBorder: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-show-border") !== "false",
        renderHTML: (attributes) => ({
          "data-show-border": String(attributes.showBorder ?? true),
        }),
      },
      // All chart types; see CustomSizeFields above. Undefined (not a
      // sentinel number) means "auto" — parseHTML must distinguish a
      // missing attribute from an explicit 0, so it checks for null
      // rather than falling back with `??`.
      width: {
        default: undefined,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-width");
          return raw === null ? undefined : Number(raw);
        },
        renderHTML: (attributes) =>
          typeof attributes.width === "number" ? { "data-width": String(attributes.width) } : {},
      },
      height: {
        default: undefined,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-height");
          return raw === null ? undefined : Number(raw);
        },
        renderHTML: (attributes) =>
          typeof attributes.height === "number" ? { "data-height": String(attributes.height) } : {},
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
      // scatter only — mirrors anvilnote-charts's own default (Economist
      // red, swapped from gray per explicit feedback alongside the
      // scatter points' own default moving to near-black).
      trendLineColor: {
        default: "#E3120B",
        parseHTML: (element) => element.getAttribute("data-trend-line-color") ?? "#E3120B",
        renderHTML: (attributes) => ({
          "data-trend-line-color": attributes.trendLineColor ?? "#E3120B",
        }),
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
      // Mirrors image.ts's own caption attribute exactly — renderImage in
      // anvilnote-renderer's tiptap-to-typst.ts already reads
      // node.attrs.caption generically (not gated to node type "image"),
      // and the statsChart export case already routes through
      // renderImage(), so this needs ZERO renderer changes to work —
      // same "renderer 零新增邏輯" reuse as the export path itself.
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) =>
          attributes.caption ? { "data-caption": attributes.caption } : {},
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
