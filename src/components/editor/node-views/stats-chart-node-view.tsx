"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { StatsChartDialog } from "@/components/editor/stats-chart-dialog";
import type { BoxWhiskerEntry, CategoricalEntry, StatsChartSpec } from "@/lib/tiptap/stats-chart";

const PREVIEW_ENTRY_LIMIT = 3;

function buildSpec(node: NodeViewProps["node"]): StatsChartSpec {
  const chartType = node.attrs.chartType;
  const data = Array.isArray(node.attrs.data) ? node.attrs.data : [];
  if (chartType === "boxwhisker") {
    return { chartType: "boxwhisker", data: data as BoxWhiskerEntry[] };
  }
  if (chartType === "pie") {
    return {
      chartType: "pie",
      data: data as CategoricalEntry[],
      showLegend: node.attrs.showLegend !== false,
    };
  }
  const knownCategorical = ["bar", "column", "pyramid"] as const;
  const resolvedType = knownCategorical.includes(chartType) ? chartType : "column";
  return { chartType: resolvedType, data: data as CategoricalEntry[] };
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
  const data: (CategoricalEntry | BoxWhiskerEntry)[] = Array.isArray(node.attrs.data)
    ? node.attrs.data
    : [];
  // Same "auto-open on a freshly-inserted, still-empty node" pattern as
  // function-plot-node-view.tsx — a new node's only entry has an empty
  // label (see stats-chart.ts's defaultCategoricalData()).
  const [dialogOpen, setDialogOpen] = useState(() => !data[0]?.label);

  const spec = buildSpec(node);

  // Only entries with an actual label are worth showing in the read-only
  // summary — a freshly-inserted node starts with several blank default
  // rows (see stats-chart.ts's defaultCategoricalData/
  // defaultBoxWhiskerData), and those aren't "data" yet from the user's
  // perspective.
  const filledEntries = data.filter((entry) => entry.label?.trim());
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
          updateAttributes({ ...nextSpec, svg: nextSvg });
        }}
        open={dialogOpen}
      />
    </NodeViewWrapper>
  );
}
