import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { StatsChartNodeView } from "@/components/editor/node-views/stats-chart-node-view";
import { VISIBLE_ROW_LIMIT, defaultEntryColor, type ChartType } from "@/lib/stats-chart-defaults";

export type CategoricalEntry = { label: string; value: number; color?: string };
export type BoxWhiskerEntry = {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};

export type StatsChartSpec =
  | { chartType: "bar"; data: CategoricalEntry[] }
  | { chartType: "column"; data: CategoricalEntry[] }
  | { chartType: "pyramid"; data: CategoricalEntry[] }
  | { chartType: "pie"; data: CategoricalEntry[]; showLegend: boolean }
  | { chartType: "boxwhisker"; data: BoxWhiskerEntry[] };

// Starts a freshly-inserted node with VISIBLE_ROW_LIMIT (10) empty rows,
// not just 1 — per explicit feedback, so a user filling in several
// entries doesn't have to click "Add entry" repeatedly first. Blank
// rows left over are filtered out by the dialog before saving/rendering
// (see stats-chart-dialog.tsx's buildSpec), so unfilled trailing rows
// never reach the API as invalid empty-label entries.
function defaultCategoricalData(): CategoricalEntry[] {
  return Array.from({ length: VISIBLE_ROW_LIMIT }, (_, index) => ({
    label: "",
    value: 0,
    color: defaultEntryColor(index),
  }));
}

function defaultBoxWhiskerData(): BoxWhiskerEntry[] {
  return Array.from({ length: VISIBLE_ROW_LIMIT }, () => ({
    label: "",
    min: 0,
    q1: 0,
    median: 0,
    q3: 0,
    max: 0,
  }));
}

function parseData(value: string | null, chartType: ChartType): CategoricalEntry[] | BoxWhiskerEntry[] {
  const fallback = chartType === "boxwhisker" ? defaultBoxWhiskerData() : defaultCategoricalData();
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const AnvilStatsChart = Node.create({
  name: "statsChart",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chartType: {
        // "column" (vertical bars), not "bar" (horizontal) — per explicit
        // feedback, a freshly-inserted bar chart should default to
        // vertical, with horizontal available via the dialog's orientation
        // toggle.
        default: "column",
        parseHTML: (element) => element.getAttribute("data-chart-type") ?? "column",
        renderHTML: (attributes) => ({ "data-chart-type": attributes.chartType ?? "column" }),
      },
      data: {
        default: defaultCategoricalData(),
        parseHTML: (element) =>
          parseData(
            element.getAttribute("data-entries"),
            (element.getAttribute("data-chart-type") as ChartType) ?? "column",
          ),
        renderHTML: (attributes) => ({ "data-entries": JSON.stringify(attributes.data ?? []) }),
      },
      showLegend: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-show-legend") !== "false",
        renderHTML: (attributes) => ({
          "data-show-legend": String(attributes.showLegend ?? true),
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
    return [{ tag: 'div[data-type="stats-chart"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "stats-chart" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StatsChartNodeView);
  },
});

export function insertStatsChart(editor: Editor) {
  editor.chain().focus().insertContent({ type: "statsChart" }).run();
}
