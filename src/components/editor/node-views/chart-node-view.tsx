"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Pencil, Trash2 } from "lucide-react";
import { ChartDialog } from "@/components/editor/chart-dialog";
import { ChartPlotlyView, type PlotlyFigure } from "@/components/editor/chart-plotly-view";
import { CaptionInput } from "@/components/editor/caption-input";
import { CHART_DEFS, type ChartSlug } from "@/lib/chart/chart-registry";
import type { ChartRequestBody } from "@/lib/chart/chart-spec";

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function ChartNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.block");
  const tChart = useTranslations("editor.chart");

  const chartType = (typeof node.attrs.chartType === "string" ? node.attrs.chartType : "scatter") as ChartSlug;
  const specRaw = typeof node.attrs.spec === "string" ? node.attrs.spec : "{}";
  const plotlyJsonRaw = typeof node.attrs.plotlyJson === "string" ? node.attrs.plotlyJson : null;
  const staticImage = typeof node.attrs.staticImage === "string" ? node.attrs.staticImage : null;
  const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";

  const hasSaved = !!plotlyJsonRaw || !!staticImage;
  // Same auto-open-on-fresh-insert / delete-if-never-saved pattern as the
  // old stats-chart-node-view.tsx — see that file's own comment for why
  // the "saved" check has to be a ref, not a state read inside the close
  // effect (an in-flight onSave→updateAttributes transaction isn't
  // guaranteed to have landed by the time the close effect runs).
  const [dialogOpen, setDialogOpen] = useState(() => !hasSaved);
  const hasSavedRef = useRef(hasSaved);
  useEffect(() => {
    if (!dialogOpen && !hasSavedRef.current) {
      deleteNode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  const spec = parseJson<Record<string, unknown>>(specRaw, {});
  const initialBody: ChartRequestBody | null = hasSaved
    ? ({ chart: chartType, format: "plotly-json", ...spec } as ChartRequestBody)
    : null;

  const plotlyFigure = plotlyJsonRaw ? parseJson<PlotlyFigure | null>(plotlyJsonRaw, null) : null;

  return (
    <NodeViewWrapper className="anvil-chart relative my-2" contentEditable={false}>
      <div className="group relative flex min-h-[160px] items-center justify-center overflow-hidden rounded border p-2">
        {plotlyFigure ? (
          // aspect-[4/3] matches render.py's kaleido export canvas exactly —
          // see chart-dialog.tsx's own preview container for why this has
          // to be an aspect ratio, not a fixed height. pt/pr insets the plot
          // itself away from the top-right corner so Plotly's own modebar
          // (camera/zoom/pan/...) doesn't render directly under the edit/
          // delete buttons living in that same corner.
          // draggable={false} — the block's own draggable:true (needed by
          // block-handle.tsx's grip, which drives moves itself via
          // view.dragging and never relies on this DOM attribute — see
          // @tiptap/extension-drag-handle's dragHandler) otherwise makes
          // this entire interactive area a native HTML5 drag source too, so
          // panning/clicking inside the live Plotly chart gets misread as
          // "drag this block elsewhere" and the chart jumps in the doc.
          // Same fix as image-node-view.tsx's own <img draggable={false}>.
          <div className="aspect-[4/3] w-full pt-2 pr-10" draggable={false}>
            <ChartPlotlyView figure={plotlyFigure} />
          </div>
        ) : staticImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={CHART_DEFS[chartType]?.labelKey ?? chartType} className="max-h-[220px] max-w-full" draggable={false} src={staticImage} />
        ) : (
          <span className="p-4 text-sm text-muted-foreground">{t("types.chart")}</span>
        )}
        <div
          className="absolute top-1 right-1 hidden group-hover:flex"
          // Without this, mousedown bubbles up to ProseMirror's own node
          // selection handling first — the block gets selected (its bubble
          // menu pops up) before our onClick ever fires, so the button
          // visibly does nothing on the first click.
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label={t("edit", { type: t("types.chart") })}
            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
            onClick={() => setDialogOpen(true)}
            title={t("edit", { type: t("types.chart") })}
            type="button"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            aria-label={t("delete", { type: t("types.chart") })}
            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
            onClick={() => deleteNode()}
            title={t("delete", { type: t("types.chart") })}
            type="button"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {/* Mirrors image-node-view.tsx's own figcaption — see stats-chart's
          historical comment on why charts share the SAME anvil-figure
          counter images use. */}
      <figcaption className="anvil-image__caption" contentEditable={false}>
        <span className="anvil-image__caption-label" data-label={tChart("figure")} />
        <CaptionInput
          value={caption}
          placeholder={tChart("captionPlaceholder")}
          onChange={(value) => updateAttributes({ caption: value })}
          className="anvil-caption-input"
        />
      </figcaption>
      <ChartDialog
        initialBody={initialBody}
        initialPlotlyFigure={plotlyFigure}
        onOpenChange={setDialogOpen}
        onSave={(body, plotlyJson, staticImageDataUrl) => {
          hasSavedRef.current = true;
          const { chart: nextChartType, format: _format, ...rest } = body;
          updateAttributes({
            chartType: nextChartType,
            spec: JSON.stringify(rest),
            plotlyJson,
            staticImage: staticImageDataUrl,
          });
        }}
        open={dialogOpen}
      />
    </NodeViewWrapper>
  );
}
