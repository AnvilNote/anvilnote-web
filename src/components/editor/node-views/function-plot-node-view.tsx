"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { FunctionPlotDialog } from "@/components/editor/function-plot-dialog";
import type { FunctionPlotCurve, FunctionPlotSpec } from "@/lib/tiptap/function-plot";

export function FunctionPlotNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.block");
  const curves: FunctionPlotCurve[] = Array.isArray(node.attrs.curves) ? node.attrs.curves : [];
  const svg = typeof node.attrs.svg === "string" ? node.attrs.svg : null;
  // Freshly inserted nodes have one curve with an empty formula (see
  // function-plot.ts's defaultCurves()) — open the dialog immediately so
  // inserting flows straight into editing, without needing a separate
  // "insert vs. edit" mode threaded through from the slash command.
  const [dialogOpen, setDialogOpen] = useState(() => !curves[0]?.formula);

  const spec: FunctionPlotSpec = {
    curves,
    xMin: typeof node.attrs.xMin === "number" ? node.attrs.xMin : -10,
    xMax: typeof node.attrs.xMax === "number" ? node.attrs.xMax : 10,
    showGridlines: node.attrs.showGridlines !== false,
    showAxisTicks: node.attrs.showAxisTicks !== false,
  };

  return (
    <NodeViewWrapper className="relative my-2" contentEditable={false}>
      <div
        className="group relative flex min-h-[80px] cursor-pointer items-center justify-center rounded border"
        onClick={() => setDialogOpen(true)}
      >
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <span className="text-muted-foreground p-4 text-sm">{t("types.functionPlot")}</span>
        )}
        <div
          className="absolute top-1 right-1 hidden group-hover:flex"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label={t("delete", { type: t("types.functionPlot") })}
            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              deleteNode();
            }}
            title={t("delete", { type: t("types.functionPlot") })}
            type="button"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <FunctionPlotDialog
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
