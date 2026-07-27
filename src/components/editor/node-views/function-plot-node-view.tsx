"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { FunctionPlotDialog } from "@/components/editor/function-plot-dialog";
import {
  defaultFunctionPlotSpec,
  type FunctionPlotCurve,
  type FunctionPlotSpec,
} from "@/lib/tiptap/function-plot";

export function FunctionPlotNodeView({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const t = useTranslations("editor.block");
  const defaults = defaultFunctionPlotSpec();
  const curves: FunctionPlotCurve[] = Array.isArray(node.attrs.curves)
    ? node.attrs.curves.map((curve: Record<string, unknown>) => ({
        ...defaults.curves[0],
        ...curve,
        expr:
          typeof curve.expr === "string"
            ? curve.expr
            : typeof curve.formula === "string"
              ? curve.formula
              : "",
      }))
    : defaults.curves;
  const preview =
    typeof node.attrs.preview === "string" ? node.attrs.preview : null;
  const [dialogOpen, setDialogOpen] = useState(() => !curves[0]?.expr);
  const hasSavedRef = useRef(!!curves[0]?.expr);

  useEffect(() => {
    if (!dialogOpen && !hasSavedRef.current) deleteNode();
    // deleteNode is a stable Tiptap callback; adding it here makes newly
    // inserted nodes disappear during harmless NodeView re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  const spec: FunctionPlotSpec = {
    mode: node.attrs.mode ?? defaults.mode,
    curves,
    axis: node.attrs.axis ?? defaults.axis,
    grid: node.attrs.grid ?? defaults.grid,
    ticks: node.attrs.ticks ?? defaults.ticks,
    colorMode: node.attrs.colorMode ?? defaults.colorMode,
  };

  return (
    <NodeViewWrapper className="relative my-2" contentEditable={false}>
      <div
        className="group relative flex min-h-20 cursor-pointer items-center justify-center rounded-md border bg-background"
        onClick={() => setDialogOpen(true)}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={t("types.functionPlot")}
            className="max-h-[32rem] max-w-full object-contain"
            src={preview}
          />
        ) : (
          <span className="p-4 text-sm text-muted-foreground">
            {t("types.functionPlot")}
          </span>
        )}
        <div
          className="absolute top-1 right-1 hidden group-hover:flex"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label={t("delete", { type: t("types.functionPlot") })}
            className="flex size-7 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-destructive"
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
        onSave={(nextSpec, pdf, nextPreview) => {
          hasSavedRef.current = true;
          updateAttributes({ ...nextSpec, pdf, preview: nextPreview });
        }}
        open={dialogOpen}
      />
    </NodeViewWrapper>
  );
}
