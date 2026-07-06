import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FunctionPlotNodeView } from "@/components/editor/node-views/function-plot-node-view";
import { defaultCurveStyle, type DashStyle } from "@/lib/function-plot-defaults";

export type FunctionPlotCurve = { formula: string; color: string; dash: DashStyle };

export type FunctionPlotSpec = {
  curves: FunctionPlotCurve[];
  xMin: number;
  xMax: number;
  showGridlines: boolean;
};

function defaultCurves(): FunctionPlotCurve[] {
  return [{ formula: "", ...defaultCurveStyle(0) }];
}

function parseCurves(value: string | null): FunctionPlotCurve[] {
  if (!value) return defaultCurves();
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultCurves();
  } catch {
    return defaultCurves();
  }
}

export const AnvilFunctionPlot = Node.create({
  name: "functionPlot",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      curves: {
        default: defaultCurves(),
        parseHTML: (element) => parseCurves(element.getAttribute("data-curves")),
        renderHTML: (attributes) => ({ "data-curves": JSON.stringify(attributes.curves ?? []) }),
      },
      xMin: {
        default: -10,
        parseHTML: (element) => Number(element.getAttribute("data-x-min") ?? -10),
        renderHTML: (attributes) => ({ "data-x-min": String(attributes.xMin ?? -10) }),
      },
      xMax: {
        default: 10,
        parseHTML: (element) => Number(element.getAttribute("data-x-max") ?? 10),
        renderHTML: (attributes) => ({ "data-x-max": String(attributes.xMax ?? 10) }),
      },
      showGridlines: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-show-gridlines") !== "false",
        renderHTML: (attributes) => ({
          "data-show-gridlines": String(attributes.showGridlines ?? true),
        }),
      },
      svg: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-svg"),
        renderHTML: (attributes) => (attributes.svg ? { "data-svg": attributes.svg } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="function-plot"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "function-plot" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FunctionPlotNodeView);
  },
});

export function insertFunctionPlot(editor: Editor) {
  editor.chain().focus().insertContent({ type: "functionPlot" }).run();
}
