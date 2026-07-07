// Economist-style default cycle (matching anvilnote-charts's own
// DEFAULT_COLOR_CYCLE — see build-typst.ts's comment for the full
// rationale and source link) — per explicit feedback replacing the
// earlier grayscale cycle. Kept as a separate constant (not shared/
// imported from anvilnote-charts) since these are two different repos
// with no shared package — same duplication convention already used for
// the render-spec schemas themselves. function-plot-defaults.ts's own
// cycle is untouched — this palette change is scoped to stats charts only.
export const DEFAULT_COLOR_CYCLE = ["#E3120B", "#0D0D0D", "#999999", "#FF6B6B", "#BBBBBB", "#FF9999"];
export const MAX_ENTRIES = 20;
// Matches anvilnote-charts's own SCATTER_MAX_ENTRIES — see that repo's
// schema.ts for the empirical compile-time measurement behind 5000
// (~7.6s at 5000 points real-compiled via Typst 0.14.2/cetz 0.4.0;
// 10000 exceeded the compiler's own 8s timeout).
export const SCATTER_MAX_ENTRIES = 5000;
export const MAX_SERIES = 6;
// Data-entry grid shows at most this many rows before collapsing the rest
// behind a "Show more" toggle — a spreadsheet-style default screenful
// rather than always rendering up to MAX_ENTRIES rows at once. Lowered
// from 10 to 5 per explicit feedback that the dialog felt too tall.
export const VISIBLE_ROW_LIMIT = 5;
// Matches anvilnote-charts's own MAX_SCALED_DIMENSION/2 (build-typst.ts) —
// past this many entries, the chart's own size clamp stops growing with
// entry count and bars/boxes start getting proportionally narrower
// instead. A warning toast at this exact threshold ties the UI hint to
// the actual point where crowding starts, not an arbitrary number.
export const CROWDED_ENTRY_THRESHOLD = 12;

export function defaultEntryColor(index: number): string {
  return DEFAULT_COLOR_CYCLE[index % DEFAULT_COLOR_CYCLE.length];
}

export const CHART_TYPES = ["bar", "column", "stackedBar", "stackedColumn", "pie", "line", "scatter", "boxwhisker"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

// UI-level grouping for the chart-type picker: "bar" and "column" are the
// same underlying idea (a bar chart) with different orientations, so they
// share one dropdown entry — "長條圖"/"Bar chart" — with a separate
// orientation toggle shown only for that group, rather than two separate
// entries a user has to already know differ only in orientation.
export const CHART_TYPE_GROUPS = ["bar", "stackedBar", "pie", "line", "scatter", "boxwhisker"] as const;
export type ChartTypeGroup = (typeof CHART_TYPE_GROUPS)[number];

export function chartTypeGroup(chartType: ChartType): ChartTypeGroup {
  if (chartType === "stackedColumn") return "stackedBar";
  return chartType === "column" ? "bar" : chartType;
}

// Chart-wide text font — mirrors anvilnote-charts's own fontFamilySchema
// (sans/serif preset roles, matching anvilnote-renderer's title/body
// fonts). Applies to all chart types.
export const FONT_FAMILIES = ["sans", "serif"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
