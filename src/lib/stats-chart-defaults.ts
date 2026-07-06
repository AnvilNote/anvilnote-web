// Same grayscale rationale as function-plot-defaults.ts: AnvilNote's design
// system has zero color hues, so new categorical entries default to shades
// of gray (matching anvilnote-charts's own DEFAULT_COLOR_CYCLE) instead of
// introducing hues. Kept as a separate constant (not shared/imported from
// anvilnote-charts) since these are two different repos with no shared
// package — same duplication convention already used for the render-spec
// schemas themselves.
export const DEFAULT_COLOR_CYCLE = ["#000000", "#404040", "#737373", "#a6a6a6", "#d9d9d9"];
export const MAX_ENTRIES = 20;

export function defaultEntryColor(index: number): string {
  return DEFAULT_COLOR_CYCLE[index % DEFAULT_COLOR_CYCLE.length];
}

export const CHART_TYPES = ["bar", "column", "pie", "pyramid", "boxwhisker"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export function isCategoricalChartType(chartType: ChartType): boolean {
  return chartType !== "boxwhisker";
}
