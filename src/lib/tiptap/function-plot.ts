import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FunctionPlotNodeView } from "@/components/editor/node-views/function-plot-node-view";
import {
  DEFAULT_GRID_STEP,
  defaultCurve,
  type FunctionPlotMode,
} from "@/lib/function-plot-defaults";

export type FunctionPlotCurve = {
  expr: string;
  color: string;
  label: string | null;
  labelOffsetX: number;
  labelOffsetY: number;
};
export type AxisBound = number | "Infinity" | "-Infinity";
export type AxisRange = [AxisBound, AxisBound] | null;
export type FunctionPlotAxis = {
  xLabel: string;
  yLabel: string;
  zLabel: string;
  xRange: AxisRange;
  yRange: AxisRange;
  zRange: AxisRange;
};
export type FunctionPlotGrid = { enabled: boolean; step: number };
export type FunctionPlotTicks = { enabled: boolean };
export type FunctionPlotSpec = {
  mode: FunctionPlotMode;
  curves: FunctionPlotCurve[];
  axis: FunctionPlotAxis;
  grid: FunctionPlotGrid;
  ticks: FunctionPlotTicks;
  colorMode: "bw" | "colormap";
};

function defaultAxis(): FunctionPlotAxis {
  return {
    xLabel: "x",
    yLabel: "y",
    zLabel: "z",
    xRange: null,
    yRange: null,
    zRange: null,
  };
}

function defaultGrid(): FunctionPlotGrid {
  return { enabled: false, step: DEFAULT_GRID_STEP };
}

function defaultTicks(): FunctionPlotTicks {
  return { enabled: false };
}

export function defaultFunctionPlotSpec(): FunctionPlotSpec {
  return {
    mode: "2d",
    curves: [defaultCurve()],
    axis: defaultAxis(),
    grid: defaultGrid(),
    ticks: defaultTicks(),
    colorMode: "bw",
  };
}

function parseJsonAttr<T>(value: string | null, fallback: () => T): T {
  if (!value) return fallback();
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback();
  }
}

function parseCurves(value: string | null): FunctionPlotCurve[] {
  const curves = parseJsonAttr<Record<string, unknown>[]>(value, () => []);
  if (!Array.isArray(curves) || curves.length === 0) return [defaultCurve()];
  return curves.map((curve, index) => ({
    ...defaultCurve(index),
    expr:
      typeof curve.expr === "string"
        ? curve.expr
        : typeof curve.formula === "string"
          ? curve.formula
          : "",
    color: typeof curve.color === "string" ? curve.color : "#000000",
    label: typeof curve.label === "string" && curve.label.trim() ? curve.label : null,
    labelOffsetX:
      typeof curve.labelOffsetX === "number" ? curve.labelOffsetX : 0,
    labelOffsetY:
      typeof curve.labelOffsetY === "number" ? curve.labelOffsetY : 0,
  }));
}

export const AnvilFunctionPlot = Node.create({
  name: "functionPlot",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mode: {
        default: "2d",
        parseHTML: (element) => element.getAttribute("data-mode") ?? "2d",
        renderHTML: (attributes) => ({ "data-mode": attributes.mode ?? "2d" }),
      },
      curves: {
        default: [defaultCurve()],
        parseHTML: (element) => parseCurves(element.getAttribute("data-curves")),
        renderHTML: (attributes) => ({
          "data-curves": JSON.stringify(attributes.curves ?? []),
        }),
      },
      axis: {
        default: defaultAxis(),
        parseHTML: (element) => {
          const parsed = parseJsonAttr<FunctionPlotAxis | null>(
            element.getAttribute("data-axis"),
            () => null,
          );
          if (parsed) return { ...defaultAxis(), ...parsed };
          const oldMin = Number(element.getAttribute("data-x-min"));
          const oldMax = Number(element.getAttribute("data-x-max"));
          return {
            ...defaultAxis(),
            xRange:
              Number.isFinite(oldMin) && Number.isFinite(oldMax)
                ? [oldMin, oldMax]
                : null,
          };
        },
        renderHTML: (attributes) => ({
          "data-axis": JSON.stringify(attributes.axis ?? defaultAxis()),
        }),
      },
      grid: {
        default: defaultGrid(),
        parseHTML: (element) => {
          const value = element.getAttribute("data-grid");
          if (value) return parseJsonAttr(value, defaultGrid);
          return {
            enabled: element.getAttribute("data-show-gridlines") !== "false",
            step: DEFAULT_GRID_STEP,
          };
        },
        renderHTML: (attributes) => ({
          "data-grid": JSON.stringify(attributes.grid ?? defaultGrid()),
        }),
      },
      ticks: {
        default: defaultTicks(),
        parseHTML: (element) => {
          const value = element.getAttribute("data-ticks");
          if (value) return parseJsonAttr(value, defaultTicks);
          return {
            enabled: element.getAttribute("data-show-axis-ticks") !== "false",
          };
        },
        renderHTML: (attributes) => ({
          "data-ticks": JSON.stringify(attributes.ticks ?? defaultTicks()),
        }),
      },
      colorMode: {
        default: "bw",
        parseHTML: (element) =>
          element.getAttribute("data-color-mode") ?? "bw",
        renderHTML: (attributes) => ({
          "data-color-mode": attributes.colorMode ?? "bw",
        }),
      },
      pdf: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-pdf"),
        renderHTML: (attributes) =>
          attributes.pdf ? { "data-pdf": attributes.pdf } : {},
      },
      preview: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-preview"),
        renderHTML: (attributes) =>
          attributes.preview ? { "data-preview": attributes.preview } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="function-plot"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "function-plot" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FunctionPlotNodeView);
  },
});

export function insertFunctionPlot(editor: Editor) {
  editor.chain().focus().insertContent({ type: "functionPlot" }).run();
}
