export type FunctionPlotMode = "1d" | "2d" | "3d-surface" | "3d-contour";

export const MAX_CURVES_BY_MODE: Record<FunctionPlotMode, number> = {
  "1d": 5,
  "2d": 5,
  "3d-surface": 1,
  "3d-contour": 1,
};

export const DEFAULT_COLOR = "#000000";
export const DEFAULT_GRID_STEP = 1;
export const CURVE_PREVIEW_LIMIT = 3;

// Default names cycle f, g, h, i, j -- matches the max curve count (5) so
// every row gets a distinct, editable starting name; a user is always free
// to rename or clear it (empty means no label drawn at all).
const DEFAULT_LABEL_CYCLE = ["f", "g", "h", "i", "j"];

export function defaultCurve(index = 0): {
  expr: string;
  color: string;
  label: string | null;
  labelOffsetX: number;
  labelOffsetY: number;
} {
  return {
    expr: "",
    color: DEFAULT_COLOR,
    label: DEFAULT_LABEL_CYCLE[index % DEFAULT_LABEL_CYCLE.length],
    labelOffsetX: 0,
    labelOffsetY: 0,
  };
}
