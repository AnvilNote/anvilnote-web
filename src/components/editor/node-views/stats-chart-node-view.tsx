"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { StatsChartDialog } from "@/components/editor/stats-chart-dialog";
import type { BoxWhiskerEntry, CategoricalEntry, StatsChartSpec } from "@/lib/tiptap/stats-chart";

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

export function StatsChartNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.block");
  const svg = typeof node.attrs.svg === "string" ? node.attrs.svg : null;
  const data = Array.isArray(node.attrs.data) ? node.attrs.data : [];
  // Same "auto-open on a freshly-inserted, still-empty node" pattern as
  // function-plot-node-view.tsx — a new node's only entry has an empty
  // label (see stats-chart.ts's defaultCategoricalData()).
  const [dialogOpen, setDialogOpen] = useState(() => !data[0]?.label);

  const spec = buildSpec(node);

  return (
    <NodeViewWrapper className="relative my-2" contentEditable={false}>
      <div
        className="group relative flex min-h-[80px] cursor-pointer items-center justify-center rounded border"
        onClick={() => setDialogOpen(true)}
      >
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <span className="text-muted-foreground p-4 text-sm">{t("types.statsChart")}</span>
        )}
        <div
          className="absolute top-1 right-1 hidden group-hover:flex"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Button
            onClick={(event) => {
              event.stopPropagation();
              deleteNode();
            }}
            size="sm"
            variant="outline"
          >
            {t("delete", { type: t("types.statsChart") })}
          </Button>
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
