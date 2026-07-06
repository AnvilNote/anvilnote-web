// AnvilNote's design system is deliberately grayscale (globals.css's
// --primary/--accent have zero chroma) — new curves default to black/dark
// gray + a cycling dash pattern instead of introducing new hues, matching
// that visual language. Users can still pick any color via the per-curve
// color picker.
export const DASH_CYCLE = ["solid", "dashed", "dotted", "dash-dot"] as const;
export const COLOR_CYCLE = ["#000000", "#595959"] as const;
export const MAX_CURVES = 6;
// Compact-view row cap in function-plot-dialog.tsx, matching
// stats-chart-dialog.tsx's VISIBLE_ROW_LIMIT pattern.
export const CURVE_PREVIEW_LIMIT = 3;
// Matches anvilnote-charts's own curve schema default (points) — used both
// as a new curve's initial stroke width and as the display fallback for
// older saved curves that predate this field.
export const DEFAULT_THICKNESS = 1.5;
export const MIN_THICKNESS = 0.5;
export const MAX_THICKNESS = 4;

export type DashStyle = (typeof DASH_CYCLE)[number];

export function defaultCurveStyle(index: number): { color: string; dash: DashStyle; thickness: number } {
  return {
    dash: DASH_CYCLE[index % DASH_CYCLE.length],
    color: COLOR_CYCLE[Math.floor(index / DASH_CYCLE.length) % COLOR_CYCLE.length],
    thickness: DEFAULT_THICKNESS,
  };
}
