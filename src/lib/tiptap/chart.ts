import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ChartNodeView } from "@/components/editor/node-views/chart-node-view";
import { CHART_DEFS, type ChartSlug } from "@/lib/chart/chart-registry";

function isChartSlug(value: unknown): value is ChartSlug {
  return typeof value === "string" && value in CHART_DEFS;
}

function parseJsonAttr<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const AnvilChart = Node.create({
  name: "chart",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chartType: {
        default: "scatter" satisfies ChartSlug,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-chart-type");
          return isChartSlug(raw) ? raw : "scatter";
        },
        renderHTML: (attributes) => ({ "data-chart-type": attributes.chartType }),
      },
      // Everything the API's ChartRequestBody carries EXCEPT `chart` and
      // `format` — universal style fields, colors/palette, data rows, and
      // this chart type's own extra params, all in one JSON blob rather
      // than one ProseMirror attribute per field. With 23 chart types each
      // owning a different extra-field set, mirroring every field as its
      // own addAttributes entry (the older stats-chart.ts pattern) would
      // mean 23 different attribute lists to keep in sync by hand; one
      // JSON blob keyed the same way the API body already is means adding
      // a 24th chart type touches chart-registry.ts and the Python/API
      // schemas, never this file.
      spec: {
        default: "{}",
        parseHTML: (element) => element.getAttribute("data-spec") ?? "{}",
        renderHTML: (attributes) => ({ "data-spec": attributes.spec ?? "{}" }),
      },
      // Cached interactive plotly.js figure JSON (from the last successful
      // render) — lets the node view redisplay immediately on document
      // load without a re-fetch, and is what the editor's own live view
      // renders via react-plotly.js.
      plotlyJson: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-plotly-json"),
        renderHTML: (attributes) => (attributes.plotlyJson ? { "data-plotly-json": attributes.plotlyJson } : {}),
      },
      // Cached static PNG (base64 data: URL) — used for the read-only
      // node-view fallback if plotly.js hasn't loaded yet, and is the
      // image handed to the PDF/DOCX export path the same way
      // stats-chart's old `svg` attribute was.
      staticImage: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-static-image"),
        renderHTML: (attributes) => (attributes.staticImage ? { "data-static-image": attributes.staticImage } : {}),
      },
      // Mirrors image.ts's own caption attribute exactly — see
      // stats-chart.ts's own historical comment on why this needed zero
      // renderer-side changes to work (renderImage() already reads
      // node.attrs.caption generically).
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "chart" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },
});

export function insertChart(editor: Editor) {
  editor.chain().focus().insertContent({ type: "chart" }).run();
}

export { parseJsonAttr };
