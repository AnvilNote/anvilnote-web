"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { StatsChartDialog } from "@/components/editor/stats-chart-dialog";
import type {
  AxisLabelFields,
  BoxWhiskerEntry,
  CategoricalEntry,
  FontFamily,
  PercentagePlacement,
  ScatterEntry,
  StatsChartSpec,
  TrendLine,
} from "@/lib/tiptap/stats-chart";

const PREVIEW_ENTRY_LIMIT = 3;
const PERCENTAGE_PLACEMENTS = ["none", "onSlice", "beside"] as const;
const TREND_LINES = ["none", "linear", "lowess"] as const;

function axisLabelFields(node: NodeViewProps["node"]): AxisLabelFields {
  return {
    xLabel: typeof node.attrs.xLabel === "string" ? node.attrs.xLabel : "",
    yLabel: typeof node.attrs.yLabel === "string" ? node.attrs.yLabel : "",
    yLabelRotated: node.attrs.yLabelRotated !== false,
  };
}

function buildSpec(node: NodeViewProps["node"]): StatsChartSpec {
  const chartType = node.attrs.chartType;
  const data = Array.isArray(node.attrs.data) ? node.attrs.data : [];
  const fontFamily: FontFamily = node.attrs.fontFamily === "serif" ? "serif" : "sans";
  if (chartType === "boxwhisker") {
    return { chartType: "boxwhisker", data: data as BoxWhiskerEntry[], fontFamily };
  }
  if (chartType === "pie") {
    const showPercentage: PercentagePlacement = PERCENTAGE_PLACEMENTS.includes(
      node.attrs.showPercentage,
    )
      ? node.attrs.showPercentage
      : "none";
    return {
      chartType: "pie",
      data: data as CategoricalEntry[],
      showLegend: node.attrs.showLegend !== false,
      showPercentage,
      fontFamily,
    };
  }
  if (chartType === "scatter") {
    const trendLine: TrendLine = TREND_LINES.includes(node.attrs.trendLine)
      ? node.attrs.trendLine
      : "none";
    return {
      chartType: "scatter",
      data: data as ScatterEntry[],
      fontFamily,
      trendLine,
      ...axisLabelFields(node),
    };
  }
  if (chartType === "line") {
    return { chartType: "line", data: data as CategoricalEntry[], fontFamily, ...axisLabelFields(node) };
  }
  const resolvedType = chartType === "bar" ? "bar" : "column";
  return {
    chartType: resolvedType,
    data: data as CategoricalEntry[],
    showValues: node.attrs.showValues === true,
    showGridLines: node.attrs.showGridLines !== false,
    fontFamily,
    ...axisLabelFields(node),
  };
}

// The read-only quick-glance value shown next to each label: categorical
// charts show their single value; box-whisker has no single "value" field,
// so its median stands in as the representative number.
function entryDisplayValue(entry: CategoricalEntry | BoxWhiskerEntry): number {
  return "value" in entry ? entry.value : entry.median;
}

export function StatsChartNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.block");
  const svg = typeof node.attrs.svg === "string" ? node.attrs.svg : null;
  const data: (CategoricalEntry | BoxWhiskerEntry | ScatterEntry)[] = Array.isArray(node.attrs.data)
    ? node.attrs.data
    : [];
  // Same "auto-open on a freshly-inserted, still-empty node" pattern as
  // function-plot-node-view.tsx. Keyed on `svg` (only ever set by a
  // successful save), NOT a data-shape-specific field like "label" —
  // scatter's own entries have no label field at all, so a label-based
  // check would treat every scatter chart (even one already saved with
  // real data) as "empty" and wrongly auto-reopen/auto-delete it.
  const [dialogOpen, setDialogOpen] = useState(() => !svg);

  // Closing without ever having saved (Cancel, or the ×/Esc dismiss)
  // removes the node entirely rather than leaving a blank, useless chart
  // block behind. Tracked via a REF (not by reading node.attrs.data in
  // the close effect) because updateAttributes' underlying ProseMirror
  // transaction and React's own state update (setDialogOpen(false),
  // fired right after it by the dialog's save wrapper) aren't guaranteed
  // to land in the same render pass — a real save's onSave→
  // updateAttributes call can still be "in flight" by the time the
  // close-effect below runs, which would otherwise see STALE (still-
  // empty) attrs and incorrectly delete a just-saved node. This was
  // caught by an actual live test (save real data, node vanished
  // immediately after), not just reasoned about — a ref mutation inside
  // onSave is synchronous and has no such race, since it doesn't depend
  // on which render the effect happens to run in.
  const hasSavedRef = useRef(!!svg);
  useEffect(() => {
    if (!dialogOpen && !hasSavedRef.current) {
      deleteNode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  const spec = buildSpec(node);

  // Only entries with an actual label are worth showing in the read-only
  // summary — a freshly-inserted node starts with several blank default
  // rows (see stats-chart.ts's defaultCategoricalData/
  // defaultBoxWhiskerData), and those aren't "data" yet from the user's
  // perspective. Scatter entries have no label field at all, so this
  // naturally (and correctly) never shows a quick-glance list for them —
  // scatter has no per-point label to show one for.
  const filledEntries: (CategoricalEntry | BoxWhiskerEntry)[] = data.filter(
    (entry): entry is CategoricalEntry | BoxWhiskerEntry => "label" in entry && !!entry.label?.trim(),
  );
  const previewEntries = filledEntries.slice(0, PREVIEW_ENTRY_LIMIT);
  const hiddenEntryCount = filledEntries.length - previewEntries.length;

  return (
    <NodeViewWrapper className="relative my-2" contentEditable={false}>
      <div
        className="group relative flex min-h-[80px] cursor-pointer gap-3 overflow-hidden rounded border p-2"
        onClick={() => setDialogOpen(true)}
      >
        {previewEntries.length > 0 ? (
          <div className="flex w-32 shrink-0 flex-col justify-center gap-1 border-r pr-2 text-xs text-muted-foreground">
            {previewEntries.map((entry, index) => (
              <div className="flex justify-between gap-2" key={index}>
                <span className="truncate">{entry.label}</span>
                <span className="shrink-0">{entryDisplayValue(entry)}</span>
              </div>
            ))}
            {hiddenEntryCount > 0 ? <span>+{hiddenEntryCount}</span> : null}
          </div>
        ) : null}
        <div className="flex flex-1 items-center justify-center [&_svg]:h-auto [&_svg]:max-w-full">
          {svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="text-muted-foreground p-4 text-sm">{t("types.statsChart")}</span>
          )}
        </div>
        <div
          className="absolute top-1 right-1 hidden group-hover:flex"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label={t("delete", { type: t("types.statsChart") })}
            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              deleteNode();
            }}
            title={t("delete", { type: t("types.statsChart") })}
            type="button"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <StatsChartDialog
        initialSpec={spec}
        onOpenChange={setDialogOpen}
        onSave={(nextSpec, nextSvg) => {
          hasSavedRef.current = true;
          updateAttributes({ ...nextSpec, svg: nextSvg });
        }}
        open={dialogOpen}
      />
    </NodeViewWrapper>
  );
}
