import { CHART_DEFS, type ChartSlug } from "./chart-registry";
import { emptyRow, type ChartRow, type RowShapeId } from "./row-shapes";
import { decodeMathLabel, encodeMathLabel } from "./math-label";

export type OutputFormat = "plotly-json" | "png" | "svg" | "jpg" | "pdf";

// Exactly the POST body anvilnote-api's charts.controller.ts expects (see
// that repo's charts.schemas.ts) — camelCase, `data` shaped per the chart's
// own rowShape. This is what gets cached verbatim in the Tiptap node's
// `spec` attribute, so reopening the dialog can rehydrate straight from it
// with no separate serialization format to keep in sync.
export type ChartRequestBody = {
  chart: ChartSlug;
  format: OutputFormat;
  title: string;
  showTitle: boolean;
  xLabel: string | null;
  yLabel: string | null;
  xLabelPosition: "center" | "right";
  yLabelPosition: "center" | "top";
  showLegend: boolean;
  showGrid: boolean;
  xMin: number | null;
  xMax: number | null;
  yMin: number | null;
  yMax: number | null;
  squareGrid: boolean;
  gridStep: number | null;
  backgroundColor: string | null;
  gridColor: string | null;
  showBorderTop: boolean;
  showBorderBottom: boolean;
  showBorderLeft: boolean;
  showBorderRight: boolean;
  colors: Record<string, string>;
  palette?: string[];
  data?: ChartRow[] | number[];
  vars?: string[];
  [extraField: string]: unknown;
};

// Dialog-local draft state — numeric-optional fields are DRAFT STRINGS
// ("" = unset/auto), same pattern as the existing numeric-input.ts
// convention used throughout the editor, since a blank input and a real 0
// need to stay distinguishable while the user is typing.
export type ChartDraft = {
  chartType: ChartSlug;
  title: string;
  showTitle: boolean;
  xLabel: string;
  yLabel: string;
  xLabelPosition: "center" | "right";
  yLabelPosition: "center" | "top";
  showLegend: boolean;
  showGrid: boolean;
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
  squareGrid: boolean;
  gridStep: string;
  backgroundColor: string; // "" = unset/default
  gridColor: string; // "" = unset/default
  showBorderTop: boolean;
  showBorderBottom: boolean;
  showBorderLeft: boolean;
  showBorderRight: boolean;
  colors: Record<string, string>;
  palette: string[]; // empty array = no palette applied
  data: ChartRow[];
  vars: string[]; // scatterplot_matrix only; ignored otherwise
  extra: Record<string, string | number | boolean>;
};

function draftNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function defaultExtra(chartType: ChartSlug): Record<string, string | number | boolean> {
  const extra: Record<string, string | number | boolean> = {};
  for (const field of CHART_DEFS[chartType].fields) {
    extra[field.key] = field.default;
  }
  return extra;
}

export function defaultDraft(chartType: ChartSlug): ChartDraft {
  const def = CHART_DEFS[chartType];
  const rowCount = 5;
  const vars = def.varsOptions?.slice(0, 3) ?? [];
  return {
    chartType,
    title: "",
    showTitle: true,
    xLabel: "",
    yLabel: "",
    xLabelPosition: "center",
    yLabelPosition: "center",
    showLegend: true,
    showGrid: true,
    xMin: "",
    xMax: "",
    yMin: "",
    yMax: "",
    squareGrid: false,
    gridStep: "",
    backgroundColor: "",
    gridColor: "",
    showBorderTop: false,
    showBorderBottom: false,
    showBorderLeft: false,
    showBorderRight: false,
    colors: {},
    palette: [],
    data: Array.from({ length: rowCount }, () => emptyRow(def.rowShape, vars)),
    vars,
    extra: defaultExtra(chartType),
  };
}

// Rehydrates dialog state from a previously-saved request body (reopening
// an existing chart node) — the inverse of buildRequestBody below.
export function draftFromRequestBody(body: ChartRequestBody): ChartDraft {
  const def = CHART_DEFS[body.chart];
  const vars = (body.vars as string[] | undefined) ?? def.varsOptions?.slice(0, 3) ?? [];
  const rawData = body.data;
  const data: ChartRow[] =
    def.rowShape === "numberList"
      ? ((rawData as number[] | undefined) ?? []).map((v) => ({ value: v }))
      : ((rawData as ChartRow[] | undefined) ?? []);

  const extra = defaultExtra(body.chart);
  for (const field of def.fields) {
    const value = body[field.key];
    if (value !== undefined) extra[field.key] = value as string | number | boolean;
  }

  return {
    chartType: body.chart,
    // A saved chart's title/labels come back in the single-$...$-block
    // form encodeMathLabel produced (see buildRequestBody below) — decode
    // back to the natural "plain $math$ plain" form the input shows.
    title: decodeMathLabel(body.title),
    showTitle: body.showTitle,
    xLabel: decodeMathLabel(body.xLabel ?? ""),
    yLabel: decodeMathLabel(body.yLabel ?? ""),
    xLabelPosition: body.xLabelPosition === "right" ? "right" : "center",
    yLabelPosition: body.yLabelPosition === "top" ? "top" : "center",
    showLegend: body.showLegend,
    showGrid: body.showGrid,
    xMin: body.xMin === null || body.xMin === undefined ? "" : String(body.xMin),
    xMax: body.xMax === null || body.xMax === undefined ? "" : String(body.xMax),
    yMin: body.yMin === null || body.yMin === undefined ? "" : String(body.yMin),
    yMax: body.yMax === null || body.yMax === undefined ? "" : String(body.yMax),
    squareGrid: body.squareGrid,
    gridStep: body.gridStep === null || body.gridStep === undefined ? "" : String(body.gridStep),
    backgroundColor: body.backgroundColor ?? "",
    gridColor: body.gridColor ?? "",
    showBorderTop: body.showBorderTop,
    showBorderBottom: body.showBorderBottom,
    showBorderLeft: body.showBorderLeft,
    showBorderRight: body.showBorderRight,
    colors: body.colors ?? {},
    palette: body.palette ?? [],
    // Pads a reopened chart's data up to 5 rows even when it already has
    // some — matches the old stats-chart-dialog's own explicit padding
    // behavior (padCategoricalData et al.) so the user always has at least
    // a few blank rows ready to fill in, not just exactly however many
    // were last saved.
    data: data.length >= 5 ? data : [...data, ...Array.from({ length: 5 - data.length }, () => emptyRow(def.rowShape, vars))],
    vars,
    extra,
  };
}

// Rows that still exactly match their freshly-inserted default (see
// emptyRow) are dropped — same rationale as the old stats-chart-dialog's own
// "blank trailing rows never reach the API" filtering: a freshly-inserted
// node starts with several default rows so the user doesn't have to click
// "Add row" first, and those aren't real data yet. Compared structurally
// against emptyRow rather than a blanket "every field is '' or undefined"
// check — a row's numeric columns default to 0 (see emptyRow), which is a
// legitimate value a user can genuinely enter, so a per-field emptiness
// check would either wrongly keep every still-untouched row (0 isn't ""/
// undefined) or wrongly drop a row where the user deliberately typed 0.
function isBlankRow(row: ChartRow, shape: RowShapeId, vars: string[]): boolean {
  const blank = emptyRow(shape, vars);
  const keys = new Set([...Object.keys(row), ...Object.keys(blank)]);
  for (const key of keys) {
    if (String(row[key] ?? "") !== String(blank[key] ?? "")) return false;
  }
  return true;
}

export function buildRequestBody(draft: ChartDraft, format: OutputFormat): ChartRequestBody {
  const def = CHART_DEFS[draft.chartType];
  const cleanRows = draft.data.filter((row) => !isBlankRow(row, def.rowShape, draft.vars));

  const data: ChartRow[] | number[] | undefined =
    cleanRows.length === 0
      ? undefined
      : def.rowShape === "numberList"
        ? cleanRows.map((r) => Number(r.value))
        : cleanRows.map((row) => coerceRow(row, def.rowShape));

  const body: ChartRequestBody = {
    chart: draft.chartType,
    format,
    // encodeMathLabel wraps a natural "plain $math$ plain" title/label into
    // the single-$...$-block form Plotly's MathJax integration actually
    // needs (see that function's own comment for why) — a no-op for plain
    // text with no $...$ in it at all.
    title: encodeMathLabel(draft.title),
    showTitle: draft.showTitle,
    xLabel: draft.xLabel.trim() ? encodeMathLabel(draft.xLabel.trim()) : null,
    yLabel: draft.yLabel.trim() ? encodeMathLabel(draft.yLabel.trim()) : null,
    xLabelPosition: draft.xLabelPosition,
    yLabelPosition: draft.yLabelPosition,
    showLegend: draft.showLegend,
    showGrid: draft.showGrid,
    xMin: draftNumber(draft.xMin),
    xMax: draftNumber(draft.xMax),
    yMin: draftNumber(draft.yMin),
    yMax: draftNumber(draft.yMax),
    squareGrid: draft.squareGrid,
    gridStep: draftNumber(draft.gridStep),
    backgroundColor: draft.backgroundColor.trim() || null,
    gridColor: draft.gridColor.trim() || null,
    showBorderTop: draft.showBorderTop,
    showBorderBottom: draft.showBorderBottom,
    showBorderLeft: draft.showBorderLeft,
    showBorderRight: draft.showBorderRight,
    colors: draft.colors,
    ...(draft.palette.length > 0 ? { palette: draft.palette } : {}),
    ...(data !== undefined ? { data } : {}),
    ...(def.rowShape === "dynamicVars" ? { vars: draft.vars } : {}),
    ...draft.extra,
  };
  return body;
}

function coerceRow(row: ChartRow, shape: RowShapeId): ChartRow {
  if (shape === "numberList") return { value: Number(row.value) };
  const out: ChartRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== "string") {
      out[key] = value;
      continue;
    }
    const isTextField = key === "category" || key === "group" || key === "series" || key === "task" || key === "var1" || key === "var2" || key === "start" || key === "end";
    out[key] = isTextField ? value : Number(value);
  }
  return out;
}
