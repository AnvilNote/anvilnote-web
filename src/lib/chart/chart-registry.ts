import type { RowShapeId } from "./row-shapes";

// Economist-style default cycle — matches anvilnote-charts's own
// DEFAULT_COLOR_CYCLE, mirrored here since the two repos never share a
// package (same duplication convention as the schema mirrors elsewhere).
export const DEFAULT_COLOR_CYCLE = ["#E3120B", "#0D0D0D", "#999999", "#FF6B6B", "#BBBBBB", "#FF9999"];

// The single source of truth for what the 23 chart types are and what
// each one's own extra (non-universal) parameters look like — the TS
// analog of anvilnote-charts's own registry.py. The dialog (chart-dialog.tsx)
// walks this table to render both the extra-params controls and their
// defaults; nothing else should hardcode a per-chart-type field list.
export type ChartSlug =
  | "scatter"
  | "bar"
  | "horizontal_bar"
  | "bubble"
  | "dot"
  | "filled_area"
  | "stair"
  | "dumbbell"
  | "gantt"
  | "treemap"
  | "bubblecloud"
  | "dual_axis"
  | "box"
  | "histogram"
  | "violin"
  | "strip"
  | "error_bars"
  | "distplot"
  | "facet"
  | "error_bands"
  | "stem"
  | "heatmap"
  | "hist2d"
  | "scatterplot_matrix";

export type ChartGroup = "basic" | "statistical";

export type FieldDescriptor =
  | { key: string; kind: "slider"; labelKey: string; min: number; max: number; step: number; default: number }
  | { key: string; kind: "select"; labelKey: string; options: string[]; default: string }
  | { key: string; kind: "checkbox"; labelKey: string; default: boolean }
  | { key: string; kind: "color"; labelKey: string; default: string }
  | { key: string; kind: "text"; labelKey: string; default: string };

export type ChartDef = {
  slug: ChartSlug;
  labelKey: string;
  group: ChartGroup;
  rowShape: RowShapeId;
  fields: FieldDescriptor[];
  // scatterplot_matrix only — the fixed set of numeric columns a user can
  // pick 2-4 of for `vars`. Every other chart type's row shape is fixed,
  // so this is the one place a chart's OWN data shape is itself
  // user-configurable rather than baked into rowShape.
  varsOptions?: string[];
};

const HIST2D_COLORSCALES = ["viridis", "magma", "plasma", "inferno"];

export const CHART_DEFS: Record<ChartSlug, ChartDef> = {
  scatter: {
    slug: "scatter",
    labelKey: "scatter",
    group: "basic",
    rowShape: "groupedXy",
    fields: [
      { key: "pointSize", kind: "slider", labelKey: "pointSize", min: 1, max: 10, step: 0.5, default: 3 },
      { key: "alpha", kind: "slider", labelKey: "alpha", min: 0.1, max: 1, step: 0.05, default: 0.8 },
      { key: "trend", kind: "select", labelKey: "trend", options: ["none", "lm", "loess"], default: "none" },
      { key: "trendLabel", kind: "text", labelKey: "trendLabel", default: "" },
      { key: "groupLabel", kind: "text", labelKey: "groupLabel", default: "group" },
    ],
  },
  bar: {
    slug: "bar",
    labelKey: "bar",
    group: "basic",
    rowShape: "categorical",
    fields: [
      { key: "width", kind: "slider", labelKey: "width", min: 0.2, max: 1, step: 0.05, default: 0.9 },
      { key: "sort", kind: "checkbox", labelKey: "sort", default: false },
    ],
  },
  horizontal_bar: {
    slug: "horizontal_bar",
    labelKey: "horizontalBar",
    group: "basic",
    rowShape: "categorical",
    fields: [
      { key: "width", kind: "slider", labelKey: "width", min: 0.2, max: 1, step: 0.05, default: 0.9 },
      { key: "order", kind: "select", labelKey: "order", options: ["ascending", "descending"], default: "ascending" },
    ],
  },
  bubble: {
    slug: "bubble",
    labelKey: "bubble",
    group: "basic",
    rowShape: "bubble",
    fields: [
      { key: "sizeMin", kind: "slider", labelKey: "sizeMin", min: 1, max: 20, step: 0.5, default: 3 },
      { key: "sizeMax", kind: "slider", labelKey: "sizeMax", min: 1, max: 30, step: 0.5, default: 14 },
      { key: "alpha", kind: "slider", labelKey: "alpha", min: 0.1, max: 1, step: 0.05, default: 0.7 },
      { key: "groupLabel", kind: "text", labelKey: "groupLabel", default: "group" },
    ],
  },
  dot: {
    slug: "dot",
    labelKey: "dot",
    group: "basic",
    rowShape: "groupValue",
    fields: [
      { key: "binwidth", kind: "slider", labelKey: "binwidth", min: 0.5, max: 4, step: 0.25, default: 1 },
      { key: "dotsize", kind: "slider", labelKey: "dotsize", min: 0.3, max: 1.5, step: 0.1, default: 0.8 },
    ],
  },
  filled_area: {
    slug: "filled_area",
    labelKey: "filledArea",
    group: "basic",
    rowShape: "series",
    fields: [
      { key: "alpha", kind: "slider", labelKey: "alpha", min: 0.2, max: 1, step: 0.05, default: 1 },
      { key: "position", kind: "select", labelKey: "position", options: ["stack", "fill", "identity"], default: "stack" },
    ],
  },
  stair: {
    slug: "stair",
    labelKey: "stair",
    group: "basic",
    rowShape: "xy",
    fields: [
      { key: "linewidth", kind: "slider", labelKey: "linewidth", min: 0.3, max: 3, step: 0.1, default: 1 },
      { key: "pointsize", kind: "slider", labelKey: "pointsize", min: 0, max: 6, step: 0.5, default: 2 },
      { key: "direction", kind: "select", labelKey: "direction", options: ["hv", "vh", "mid"], default: "hv" },
      { key: "color", kind: "color", labelKey: "color", default: "#222222" },
    ],
  },
  dumbbell: {
    slug: "dumbbell",
    labelKey: "dumbbell",
    group: "basic",
    rowShape: "beforeAfter",
    fields: [
      { key: "pointsize", kind: "slider", labelKey: "pointsize", min: 2, max: 8, step: 0.5, default: 4 },
      { key: "linewidth", kind: "slider", labelKey: "linewidth", min: 0.5, max: 4, step: 0.25, default: 1 },
      { key: "segColor", kind: "color", labelKey: "segColor", default: "#999999" },
      { key: "beforeColor", kind: "color", labelKey: "beforeColor", default: "#e41a1c" },
      { key: "afterColor", kind: "color", labelKey: "afterColor", default: "#377eb8" },
    ],
  },
  gantt: {
    slug: "gantt",
    labelKey: "gantt",
    group: "basic",
    rowShape: "task",
    fields: [{ key: "linewidth", kind: "slider", labelKey: "linewidth", min: 2, max: 16, step: 1, default: 8 }],
  },
  treemap: {
    slug: "treemap",
    labelKey: "treemap",
    group: "basic",
    rowShape: "categorical",
    fields: [{ key: "border", kind: "slider", labelKey: "border", min: 0, max: 6, step: 0.5, default: 2 }],
  },
  bubblecloud: {
    slug: "bubblecloud",
    labelKey: "bubblecloud",
    group: "basic",
    rowShape: "categorical",
    fields: [],
  },
  dual_axis: {
    slug: "dual_axis",
    labelKey: "dualAxis",
    group: "basic",
    rowShape: "dualAxis",
    fields: [
      { key: "y1Label", kind: "text", labelKey: "y1Label", default: "Y1" },
      { key: "y2Label", kind: "text", labelKey: "y2Label", default: "Y2" },
      { key: "y1Type", kind: "select", labelKey: "y1Type", options: ["bar", "line"], default: "bar" },
      { key: "y2Type", kind: "select", labelKey: "y2Type", options: ["bar", "line"], default: "line" },
      { key: "y1Color", kind: "color", labelKey: "y1Color", default: "#4682B4" },
      { key: "y2Color", kind: "color", labelKey: "y2Color", default: "#e41a1c" },
    ],
  },
  box: {
    slug: "box",
    labelKey: "box",
    group: "statistical",
    rowShape: "groupValue",
    fields: [
      { key: "showOutliers", kind: "checkbox", labelKey: "showOutliers", default: true },
      { key: "notch", kind: "checkbox", labelKey: "notch", default: false },
    ],
  },
  histogram: {
    slug: "histogram",
    labelKey: "histogram",
    group: "statistical",
    rowShape: "numberList",
    fields: [
      { key: "binwidth", kind: "slider", labelKey: "binwidth", min: 1, max: 15, step: 0.5, default: 4 },
      { key: "fill", kind: "color", labelKey: "fill", default: "#4682B4" },
    ],
  },
  violin: {
    slug: "violin",
    labelKey: "violin",
    group: "statistical",
    rowShape: "groupValue",
    fields: [
      { key: "trim", kind: "checkbox", labelKey: "trim", default: true },
      { key: "scale", kind: "select", labelKey: "scale", options: ["area", "count", "width"], default: "area" },
    ],
  },
  strip: {
    slug: "strip",
    labelKey: "strip",
    group: "statistical",
    rowShape: "groupValue",
    fields: [
      { key: "jitterWidth", kind: "slider", labelKey: "jitterWidth", min: 0, max: 0.5, step: 0.02, default: 0.15 },
      { key: "pointsize", kind: "slider", labelKey: "pointsize", min: 1, max: 6, step: 0.5, default: 2.5 },
    ],
  },
  error_bars: {
    slug: "error_bars",
    labelKey: "errorBars",
    group: "statistical",
    rowShape: "meanSd",
    fields: [
      { key: "mult", kind: "slider", labelKey: "mult", min: 0.5, max: 3, step: 0.25, default: 1 },
      { key: "capwidth", kind: "slider", labelKey: "capwidth", min: 0.05, max: 0.5, step: 0.05, default: 0.2 },
      { key: "pointsize", kind: "slider", labelKey: "pointsize", min: 1, max: 6, step: 0.5, default: 3 },
      { key: "color", kind: "color", labelKey: "color", default: "#222222" },
    ],
  },
  distplot: {
    slug: "distplot",
    labelKey: "distplot",
    group: "statistical",
    rowShape: "numberList",
    fields: [
      { key: "binwidth", kind: "slider", labelKey: "binwidth", min: 1, max: 15, step: 0.5, default: 4 },
      { key: "adjust", kind: "slider", labelKey: "adjust", min: 0.2, max: 3, step: 0.1, default: 1 },
      { key: "alpha", kind: "slider", labelKey: "alpha", min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: "fill", kind: "color", labelKey: "fill", default: "#4682B4" },
      { key: "linecolor", kind: "color", labelKey: "linecolor", default: "#B22222" },
    ],
  },
  facet: {
    slug: "facet",
    labelKey: "facet",
    group: "statistical",
    rowShape: "groupedXy",
    fields: [
      { key: "ncol", kind: "slider", labelKey: "ncol", min: 1, max: 3, step: 1, default: 3 },
      { key: "scales", kind: "select", labelKey: "scales", options: ["fixed", "free", "free_x", "free_y"], default: "fixed" },
      { key: "color", kind: "color", labelKey: "color", default: "#222222" },
    ],
  },
  error_bands: {
    slug: "error_bands",
    labelKey: "errorBands",
    group: "statistical",
    rowShape: "band",
    fields: [
      { key: "mult", kind: "slider", labelKey: "mult", min: 0.5, max: 3, step: 0.25, default: 1 },
      { key: "alpha", kind: "slider", labelKey: "alpha", min: 0.1, max: 0.8, step: 0.05, default: 0.3 },
      { key: "color", kind: "color", labelKey: "color", default: "#4682B4" },
    ],
  },
  stem: {
    slug: "stem",
    labelKey: "stem",
    group: "statistical",
    rowShape: "categorical",
    fields: [
      { key: "pointsize", kind: "slider", labelKey: "pointsize", min: 1, max: 6, step: 0.5, default: 3 },
      { key: "order", kind: "select", labelKey: "order", options: ["ascending", "descending"], default: "ascending" },
      { key: "color", kind: "color", labelKey: "color", default: "#4682B4" },
      { key: "linecolor", kind: "color", labelKey: "linecolor", default: "#999999" },
    ],
  },
  heatmap: {
    slug: "heatmap",
    labelKey: "heatmap",
    group: "statistical",
    rowShape: "matrixCell",
    fields: [
      { key: "low", kind: "color", labelKey: "low", default: "#4575b4" },
      { key: "high", kind: "color", labelKey: "high", default: "#d73027" },
      { key: "midpoint", kind: "slider", labelKey: "midpoint", min: -1, max: 1, step: 0.1, default: 0 },
    ],
  },
  hist2d: {
    slug: "hist2d",
    labelKey: "hist2d",
    group: "statistical",
    rowShape: "xy",
    fields: [
      { key: "bins", kind: "slider", labelKey: "bins", min: 5, max: 60, step: 1, default: 15 },
      { key: "colorscale", kind: "select", labelKey: "colorscale", options: HIST2D_COLORSCALES, default: "viridis" },
    ],
  },
  scatterplot_matrix: {
    slug: "scatterplot_matrix",
    labelKey: "scatterplotMatrix",
    group: "statistical",
    rowShape: "dynamicVars",
    varsOptions: ["sepal_length", "sepal_width", "petal_length", "petal_width"],
    fields: [{ key: "pointsize", kind: "slider", labelKey: "pointsize", min: 0.5, max: 4, step: 0.25, default: 1 }],
  },
};

export const CHART_SLUGS = Object.keys(CHART_DEFS) as ChartSlug[];

export const CHART_GROUPS: { group: ChartGroup; slugs: ChartSlug[] }[] = [
  { group: "basic", slugs: CHART_SLUGS.filter((s) => CHART_DEFS[s].group === "basic") },
  { group: "statistical", slugs: CHART_SLUGS.filter((s) => CHART_DEFS[s].group === "statistical") },
];
