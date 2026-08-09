import type { JSONContent } from "@tiptap/core";
import type { SnapshotConversionContext, TiptapConversionContext } from "./core-node-converters";

// Tiptap JSON <-> AI document v2 mapping for the "visual" node family
// (mermaid, functionPlot, chart) — all atom nodes whose real content lives
// entirely in attrs, re-rendered client-side.
//
// `svg`/cached-render caching, verified by reading the real extensions
// directly:
//   - mermaid.ts's AnvilMermaid declares NO `svg` attr at all — it
//     re-renders from `source` via the `mermaid` package on every mount
//     (see mermaid-node-view.tsx's own local `useState<string | null>`,
//     never persisted onto the node).
//   - function-plot.ts's AnvilFunctionPlot declares a real `svg` attr (a
//     rendered-output cache, `default: null`) — never forwarded to the AI,
//     never reconstructed here on the way back; function-plot-node-view.tsx
//     recomputes it from the semantic attrs whenever missing/stale.
//   - chart.ts's AnvilChart caches TWO rendered outputs (`plotlyJson`,
//     `staticImage`) instead of one `svg` — same rationale, same handling:
//     stripped going out, nulled coming back, forcing chart-node-view.tsx to
//     treat the node as unrendered until its own dialog/render effect
//     repopulates them. The actual chart semantics (chartType + the API
//     request body minus chart/format) live in the `spec` attr as a JSON
//     STRING (see chart.ts's own comment on why one blob, not one
//     ProseMirror attribute per field, across 23 chart types) — parsed to a
//     nested object here so the AI reads/writes structured JSON, not an
//     opaque string.
function attrsOf(node: JSONContent): Record<string, unknown> {
  return node.attrs ?? {};
}

function parseSpec(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function chartAttrsToSnapshot(values: Record<string, unknown>): Record<string, unknown> {
  return {
    chartType: values.chartType,
    spec: parseSpec(values.spec),
    caption: typeof values.caption === "string" && values.caption.length > 0 ? values.caption : undefined,
  };
}

function chartAttrsFromSnapshot(values: Record<string, unknown>): Record<string, unknown> {
  const spec = values.spec && typeof values.spec === "object" ? (values.spec as Record<string, unknown>) : {};
  return {
    chartType: typeof values.chartType === "string" ? values.chartType : "scatter",
    spec: JSON.stringify(spec),
    plotlyJson: null,
    staticImage: null,
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
    case "chart":
      return { type: "chart", attrs: chartAttrsToSnapshot(values) };
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
    case "chart":
      return { type: "chart", attrs: chartAttrsFromSnapshot(values) };
    default:
      return undefined;
  }
}
