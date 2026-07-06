// Same grayscale rationale as function-plot-defaults.ts: AnvilNote's design
// system has zero color hues, so new categorical entries default to shades
// of gray (matching anvilnote-charts's own DEFAULT_COLOR_CYCLE) instead of
// introducing hues. Kept as a separate constant (not shared/imported from
// anvilnote-charts) since these are two different repos with no shared
// package — same duplication convention already used for the render-spec
// schemas themselves.
export const DEFAULT_COLOR_CYCLE = ["#000000", "#404040", "#737373", "#a6a6a6", "#d9d9d9"];
export const MAX_ENTRIES = 20;
// Data-entry grid shows at most this many rows before collapsing the rest
// behind a "Show more" toggle — a spreadsheet-style default screenful
// rather than always rendering up to MAX_ENTRIES rows at once.
export const VISIBLE_ROW_LIMIT = 10;

export function defaultEntryColor(index: number): string {
  return DEFAULT_COLOR_CYCLE[index % DEFAULT_COLOR_CYCLE.length];
}

export const CHART_TYPES = ["bar", "column", "pie", "pyramid", "boxwhisker"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

// UI-level grouping for the chart-type picker: "bar" and "column" are the
// same underlying idea (a bar chart) with different orientations, so they
// share one dropdown entry — "長條圖"/"Bar chart" — with a separate
// orientation toggle shown only for that group, rather than two separate
// entries a user has to already know differ only in orientation.
export const CHART_TYPE_GROUPS = ["bar", "pie", "pyramid", "boxwhisker"] as const;
export type ChartTypeGroup = (typeof CHART_TYPE_GROUPS)[number];

export function chartTypeGroup(chartType: ChartType): ChartTypeGroup {
  return chartType === "column" ? "bar" : chartType;
}
