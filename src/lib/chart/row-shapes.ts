// Row shapes chart data can take — mirrors anvilnote-charts's own schema.py
// row models (CategoricalRow, XYRow, GroupedXYRow, ...) and
// anvilnote-api's charts.schemas.ts row schemas. Kept as its OWN small
// enum (not 23 bespoke shapes, one per chart type) because most of the 23
// chart types share one of these ~10 underlying shapes — the generic data
// table (chart-data-table.tsx) switches on this, not on chartType, which is
// what keeps that component from growing a 23-way branch.
export type RowShapeId =
  | "categorical" // {category, value}
  | "xy" // {x, y}
  | "groupedXy" // {x, y, group}
  | "bubble" // {x, y, size, group}
  | "series" // {t, series, value}
  | "beforeAfter" // {category, before, after}
  | "task" // {task, start, end} — ISO dates
  | "groupValue" // {group, value}
  | "meanSd" // {group, mean, sd}
  | "band" // {t, value, se}
  | "matrixCell" // {var1, var2, value}
  | "numberList" // plain number[] (histogram/distplot)
  | "dynamicVars" // rows keyed by whatever `vars` names, plus "group"
  | "dualAxis"; // {category, y1, y2}

export type ChartRow = Record<string, string | number>;

// One column definition per row shape — drives both the table header and
// each cell's input type. `key` matches the field name the API expects
// (charts-cli.ts's camelToSnake only descends one level, so these must
// already be valid Python identifiers — see that file's own comment).
export type RowColumn = { key: string; labelKey: string; type: "text" | "number" | "date" };

export const ROW_SHAPE_COLUMNS: Record<Exclude<RowShapeId, "dynamicVars">, RowColumn[]> = {
  categorical: [
    { key: "category", labelKey: "category", type: "text" },
    { key: "value", labelKey: "value", type: "number" },
  ],
  xy: [
    { key: "x", labelKey: "x", type: "number" },
    { key: "y", labelKey: "y", type: "number" },
  ],
  groupedXy: [
    { key: "x", labelKey: "x", type: "number" },
    { key: "y", labelKey: "y", type: "number" },
    { key: "group", labelKey: "group", type: "text" },
  ],
  bubble: [
    { key: "x", labelKey: "x", type: "number" },
    { key: "y", labelKey: "y", type: "number" },
    { key: "size", labelKey: "size", type: "number" },
    { key: "group", labelKey: "group", type: "text" },
  ],
  series: [
    { key: "t", labelKey: "t", type: "number" },
    { key: "series", labelKey: "series", type: "text" },
    { key: "value", labelKey: "value", type: "number" },
  ],
  beforeAfter: [
    { key: "category", labelKey: "category", type: "text" },
    { key: "before", labelKey: "before", type: "number" },
    { key: "after", labelKey: "after", type: "number" },
  ],
  task: [
    { key: "task", labelKey: "task", type: "text" },
    { key: "start", labelKey: "start", type: "date" },
    { key: "end", labelKey: "end", type: "date" },
  ],
  groupValue: [
    { key: "group", labelKey: "group", type: "text" },
    { key: "value", labelKey: "value", type: "number" },
  ],
  meanSd: [
    { key: "group", labelKey: "group", type: "text" },
    { key: "mean", labelKey: "mean", type: "number" },
    { key: "sd", labelKey: "sd", type: "number" },
  ],
  band: [
    { key: "t", labelKey: "t", type: "number" },
    { key: "value", labelKey: "value", type: "number" },
    { key: "se", labelKey: "se", type: "number" },
  ],
  matrixCell: [
    { key: "var1", labelKey: "var1", type: "text" },
    { key: "var2", labelKey: "var2", type: "text" },
    { key: "value", labelKey: "value", type: "number" },
  ],
  numberList: [{ key: "value", labelKey: "value", type: "number" }],
  dualAxis: [
    { key: "category", labelKey: "category", type: "text" },
    { key: "y1", labelKey: "y1", type: "number" },
    { key: "y2", labelKey: "y2", type: "number" },
  ],
};

// Every column — including numeric ones — defaults to "", matching
// numeric-input.ts's own codebase-wide convention (a number input's "empty"
// state is the string "", not 0; see that file's own comment on why 0 can't
// double as the empty sentinel: a user clearing a numeric field back to 0
// needs to stay distinguishable from a field that was never touched).
export function emptyRow(shape: RowShapeId, vars?: string[]): ChartRow {
  if (shape === "dynamicVars") {
    const row: ChartRow = { group: "" };
    for (const v of vars ?? []) row[v] = "";
    return row;
  }
  const row: ChartRow = {};
  for (const col of ROW_SHAPE_COLUMNS[shape]) {
    row[col.key] = "";
  }
  return row;
}

// The category-ish key used to label each row for single-swatch color
// overrides (colors: Record<thisKey, hex>) — null for shapes with no
// natural per-row category (xy, band, matrixCell, numberList).
export function categoryKeyFor(shape: RowShapeId): string | null {
  switch (shape) {
    case "categorical":
    case "beforeAfter":
    case "task":
      return "category";
    case "groupedXy":
    case "bubble":
    case "groupValue":
    case "meanSd":
    case "series":
      return shape === "series" ? "series" : "group";
    case "dynamicVars":
      return "group";
    default:
      return null;
  }
}
