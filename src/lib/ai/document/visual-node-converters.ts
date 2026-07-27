import type { JSONContent } from "@tiptap/core";
import { AiSnapshotConversionError } from "./ai-snapshot-errors";
import type { SnapshotConversionContext, TiptapConversionContext } from "./core-node-converters";

// Tiptap JSON <-> AI document v2 mapping for the "visual" node family
// (mermaid, functionPlot, statsChart) — all atom nodes whose real
// content lives entirely in attrs, re-rendered client-side.
//
// `svg` caching, verified by reading the real extensions directly:
//   - mermaid.ts's AnvilMermaid declares NO `svg` attr at all — it
//     re-renders from `source` via the `mermaid` package on every mount
//     (see mermaid-node-view.tsx's own local `useState<string | null>`,
//     never persisted onto the node). The plan text driving this task
//     claimed all three visual nodes need an `svg` attr stripped; that is
//     only true for functionPlot/statsChart — mermaid has nothing to
//     strip. Documented here as a correction, not silently "fixed".
//   - function-plot.ts's AnvilFunctionPlot and stats-chart.ts's
//     AnvilStatsChart both DO declare a real `svg` attr (a rendered-output
//     cache, `default: null`, populated by their own NodeViews after
//     rendering) — never forwarded to the AI, and never reconstructed
//     here on the way back (see function-plot-node-view.tsx/
//     stats-chart-node-view.tsx: both recompute their SVG from the
//     semantic attrs on mount/update whenever the cached `svg` is missing
//     or stale, so simply omitting/nulling it here is sufficient — no
//     extra trigger needed).
function attrsOf(node: JSONContent): Record<string, unknown> {
  return node.attrs ?? {};
}

const STATS_CHART_AXIS_LABEL_TYPES = new Set([
  "bar",
  "column",
  "stackedBar",
  "stackedColumn",
  "line",
  "scatter",
]);

function statsChartAttrsToSnapshot(values: Record<string, unknown>): Record<string, unknown> {
  const chartType = values.chartType;
  const caption = typeof values.caption === "string" && values.caption.length > 0 ? values.caption : undefined;
  const sizeAndCaption = {
    ...(typeof values.width === "number" ? { width: values.width } : {}),
    ...(typeof values.height === "number" ? { height: values.height } : {}),
    ...(caption !== undefined ? { caption } : {}),
  };
  const fontFamily = typeof values.fontFamily === "string" ? values.fontFamily : "sans";
  const axisLabels = STATS_CHART_AXIS_LABEL_TYPES.has(String(chartType))
    ? {
        xLabel: typeof values.xLabel === "string" ? values.xLabel : "",
        yLabel: typeof values.yLabel === "string" ? values.yLabel : "",
        yLabelRotated: Boolean(values.yLabelRotated ?? true),
      }
    : {};

  switch (chartType) {
    case "bar":
    case "column":
      return {
        chartType,
        data: values.data,
        showValues: Boolean(values.showValues),
        showGridLines: Boolean(values.showGridLines),
        showBorder: Boolean(values.showBorder),
        fontFamily,
        ...axisLabels,
        ...sizeAndCaption,
      };
    case "stackedBar":
    case "stackedColumn":
      return {
        chartType,
        data: values.data,
        seriesLabels: Array.isArray(values.seriesLabels) ? values.seriesLabels : [],
        ...(Array.isArray(values.seriesColors) ? { seriesColors: values.seriesColors } : {}),
        showLegend: Boolean(values.showLegend),
        showGridLines: Boolean(values.showGridLines),
        showBorder: Boolean(values.showBorder),
        fontFamily,
        ...axisLabels,
        ...sizeAndCaption,
      };
    case "line":
      return { chartType, data: values.data, fontFamily, ...axisLabels, ...sizeAndCaption };
    case "scatter":
      return {
        chartType,
        data: values.data,
        fontFamily,
        trendLine: typeof values.trendLine === "string" ? values.trendLine : "none",
        trendLineColor: typeof values.trendLineColor === "string" ? values.trendLineColor : "#E3120B",
        showGridLines: Boolean(values.showGridLines),
        ...axisLabels,
        ...sizeAndCaption,
      };
    case "pie":
      return {
        chartType,
        data: values.data,
        showLegend: Boolean(values.showLegend),
        showPercentage: typeof values.showPercentage === "string" ? values.showPercentage : "none",
        fontFamily,
        ...sizeAndCaption,
      };
    case "boxwhisker":
      return { chartType, data: values.data, fontFamily, ...sizeAndCaption };
    default:
      throw new AiSnapshotConversionError(`Unknown statsChart chartType: ${String(chartType)}`);
  }
}

function statsChartAttrsFromSnapshot(values: Record<string, unknown>): Record<string, unknown> {
  const chartType = values.chartType;
  const hasAxisLabels = STATS_CHART_AXIS_LABEL_TYPES.has(String(chartType));
  const isStacked = chartType === "stackedBar" || chartType === "stackedColumn";
  const isBarColumn = chartType === "bar" || chartType === "column";
  const isPie = chartType === "pie";
  const isScatter = chartType === "scatter";

  return {
    chartType,
    data: values.data,
    seriesLabels: isStacked && Array.isArray(values.seriesLabels) ? values.seriesLabels : [],
    ...(isStacked && Array.isArray(values.seriesColors) ? { seriesColors: values.seriesColors } : {}),
    showLegend: isStacked || isPie ? Boolean(values.showLegend) : true,
    showValues: isBarColumn ? Boolean(values.showValues) : false,
    showPercentage: isPie && typeof values.showPercentage === "string" ? values.showPercentage : "none",
    showGridLines: isBarColumn || isStacked || isScatter ? Boolean(values.showGridLines) : true,
    showBorder: isBarColumn || isStacked ? Boolean(values.showBorder) : true,
    ...(typeof values.width === "number" ? { width: values.width } : {}),
    ...(typeof values.height === "number" ? { height: values.height } : {}),
    xLabel: hasAxisLabels && typeof values.xLabel === "string" ? values.xLabel : "",
    yLabel: hasAxisLabels && typeof values.yLabel === "string" ? values.yLabel : "",
    yLabelRotated: hasAxisLabels ? Boolean(values.yLabelRotated ?? true) : true,
    trendLine: isScatter && typeof values.trendLine === "string" ? values.trendLine : "none",
    trendLineColor:
      isScatter && typeof values.trendLineColor === "string" ? values.trendLineColor : "#E3120B",
    fontFamily: typeof values.fontFamily === "string" ? values.fontFamily : "sans",
    svg: null,
    caption: typeof values.caption === "string" ? values.caption : "",
  };
}

// --- Forward: Tiptap -> v2-shaped JSON ------------------------------------

export function visualBlockToSnapshot(
  node: JSONContent,
  _ctx: SnapshotConversionContext,
): JSONContent | undefined {
  const values = attrsOf(node);

  switch (node.type) {
    case "mermaid": {
      const width = typeof values.width === "number" ? values.width : undefined;
      return {
        type: "mermaid",
        attrs: {
          source: String(values.source ?? ""),
          theme: typeof values.theme === "string" ? values.theme : "default",
          // Task 24.3 fix: unconditionally present (`null` fallback) —
          // matches the API's own mapper; see
          // core-node-converters.ts's header comment. `width` is left as a
          // conditional key since BOTH mappers already agree on that gate
          // (`typeof === "number"`), so no hash-parity bug exists there.
          primaryColor: typeof values.primaryColor === "string" ? values.primaryColor : null,
          ...(width !== undefined ? { width } : {}),
        },
      };
    }
    case "functionPlot": {
      const curves = Array.isArray(values.curves)
        ? values.curves.map((curve: Record<string, unknown>) => ({
            formula: String(curve.formula ?? ""),
            color: String(curve.color ?? "#000000"),
            dash: curve.dash,
            thickness: Number(curve.thickness),
          }))
        : [];
      return {
        type: "functionPlot",
        attrs: {
          curves,
          xMin: Number(values.xMin ?? -10),
          xMax: Number(values.xMax ?? 10),
          showGridlines: Boolean(values.showGridlines ?? true),
          showAxisTicks: Boolean(values.showAxisTicks ?? true),
        },
      };
    }
    case "statsChart":
      return { type: "statsChart", attrs: statsChartAttrsToSnapshot(values) };
    default:
      return undefined;
  }
}

// --- Reverse: validated v2-shaped JSON -> Tiptap --------------------------

export function visualBlockFromSnapshot(
  node: JSONContent,
  _ctx: TiptapConversionContext,
): JSONContent | undefined {
  const values = attrsOf(node);

  switch (node.type) {
    case "mermaid":
      return {
        type: "mermaid",
        attrs: {
          source: String(values.source ?? ""),
          theme: typeof values.theme === "string" ? values.theme : "default",
          primaryColor: typeof values.primaryColor === "string" ? values.primaryColor : null,
          width: typeof values.width === "number" ? values.width : null,
        },
      };
    case "functionPlot":
      return {
        type: "functionPlot",
        attrs: {
          curves: values.curves,
          xMin: values.xMin,
          xMax: values.xMax,
          showGridlines: values.showGridlines,
          showAxisTicks: values.showAxisTicks,
          svg: null,
        },
      };
    case "statsChart":
      return { type: "statsChart", attrs: statsChartAttrsFromSnapshot(values) };
    default:
      return undefined;
  }
}
