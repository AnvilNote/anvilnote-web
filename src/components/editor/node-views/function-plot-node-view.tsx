"use client";

import { useEffect, useRef, useState } from "react";
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

  // Closing without ever having saved a formula (Cancel, or the ×/Esc
  // dismiss) removes the node entirely rather than leaving a blank,
  // useless chart block behind. Tracked via a REF (not by reading
  // node.attrs.curves in the close effect) because updateAttributes'
  // underlying ProseMirror transaction and React's own state update
  // (setDialogOpen(false), fired right after it by the dialog's save
  // wrapper) aren't guaranteed to land in the same render pass — a real
  // save's onSave→updateAttributes call can still be "in flight" by the
  // time the close-effect below runs, which would otherwise see STALE
  // (still-empty) attrs and incorrectly delete a just-saved node. This
  // was caught by an actual live test on stats-chart-node-view.tsx's
  // equivalent check (save real data, node vanished immediately after),
  // not just reasoned about — a ref mutation inside onSave is
  // synchronous and has no such race, since it doesn't depend on which
  // render the effect happens to run in.
  const hasSavedRef = useRef(!!curves[0]?.formula);
  useEffect(() => {
    if (!dialogOpen && !hasSavedRef.current) {
      deleteNode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

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
          hasSavedRef.current = true;
          updateAttributes({ ...nextSpec, svg: nextSvg });
        }}
        open={dialogOpen}
      />
    </NodeViewWrapper>
  );
}
