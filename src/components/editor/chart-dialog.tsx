"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChartColorControls } from "@/components/editor/chart-color-controls";
import { ChartDataTable } from "@/components/editor/chart-data-table";
import { ChartExtraFields } from "@/components/editor/chart-extra-fields";
import { ChartPlotlyView, type PlotlyFigure } from "@/components/editor/chart-plotly-view";
import { renderChart } from "@/lib/chart/chart-render-client";
import { buildRequestBody, defaultDraft, draftFromRequestBody, type ChartDraft, type ChartRequestBody } from "@/lib/chart/chart-spec";
import { categoryKeyFor } from "@/lib/chart/row-shapes";
import { CHART_DEFS, CHART_GROUPS, type ChartSlug } from "@/lib/chart/chart-registry";
import { InlineMathText } from "@/components/editor/inline-math-text";

// title/xLabel/yLabel accept Plotly's own $...$ LaTeX syntax (see
// anvilnote-charts's render.py for the matching kaleido-side MathJax
// config) — shown only once the field actually contains a $...$ pair, so a
// plain title doesn't grow an empty preview row underneath it.
function MathLabelPreview({ value }: { value: string }) {
  if (!/\$[^$]+\$/.test(value)) return null;
  return (
    <div className="rounded-2xl border border-dashed px-3 py-1.5 text-sm">
      <InlineMathText text={value} />
    </div>
  );
}

export type ChartDialogProps = {
  open: boolean;
  initialBody: ChartRequestBody | null; // null = fresh insert
  // The already-rendered figure for initialBody, if this chart was saved
  // before — lets the dialog show it immediately on open instead of
  // recompiling a spec that hasn't actually changed since the last save.
  initialPlotlyFigure: PlotlyFigure | null;
  onOpenChange: (open: boolean) => void;
  onSave: (body: ChartRequestBody, plotlyJson: string, staticImageDataUrl: string) => void;
};

export function ChartDialog({ open, initialBody, initialPlotlyFigure, onOpenChange, onSave }: ChartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ChartForm
          initialBody={initialBody}
          initialPlotlyFigure={initialPlotlyFigure}
          onCancel={() => onOpenChange(false)}
          onSave={(body, plotlyJson, image) => {
            onSave(body, plotlyJson, image);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function ChartForm({
  initialBody,
  initialPlotlyFigure,
  onCancel,
  onSave,
}: {
  initialBody: ChartRequestBody | null;
  initialPlotlyFigure: PlotlyFigure | null;
  onCancel: () => void;
  onSave: (body: ChartRequestBody, plotlyJson: string, staticImageDataUrl: string) => void;
}) {
  const t = useTranslations("editor.chart");
  const [draft, setDraft] = useState<ChartDraft>(() =>
    initialBody ? draftFromRequestBody(initialBody) : defaultDraft("scatter"),
  );
  const def = CHART_DEFS[draft.chartType];

  // Native CSS `resize` doesn't work here: DialogContent is `position:
  // fixed` and centered via `translate(-50%,-50%)`, and Chromium computes
  // the resize-handle hit target from the untransformed layout box, which
  // isn't where the box actually renders — the handle silently does
  // nothing. Drag-resizing by hand instead; dragging by dx grows width by
  // 2*dx (not dx) because growing width also re-centers the box via that
  // same -50% translate, which would otherwise make the edge lag behind
  // the cursor by half the growth.
  const dialogRef = useRef<HTMLDivElement>(null);
  const [customSize, setCustomSize] = useState<{ width: number; height: number } | null>(null);
  // Listeners live on the handle itself (via pointer capture), not window —
  // window-level listeners only got cleaned up by a matching pointerup, and
  // any dropped/missed pointerup (pointer leaves the window, a stray
  // pointercancel, etc.) leaked them permanently. Every leaked listener kept
  // reacting to all future pointer movement anywhere on the page with its
  // own stale start position, each one fighting the others' setCustomSize
  // calls. Pointer capture makes the browser route all of this pointerId's
  // events to the handle regardless of where the cursor physically is, and
  // reliably fires pointerup/pointercancel/lostpointercapture so cleanup
  // can't be skipped.
  const handleResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = dialogRef.current;
    const handle = e.currentTarget;
    if (!el) return;
    handle.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const startX = e.clientX;
    const startY = e.clientY;

    function onMove(ev: PointerEvent) {
      const maxWidth = window.innerWidth * 0.95;
      const maxHeight = window.innerHeight * 0.95;
      const width = Math.min(maxWidth, Math.max(720, startWidth + (ev.clientX - startX) * 2));
      const height = Math.min(maxHeight, Math.max(420, startHeight + (ev.clientY - startY) * 2));
      setCustomSize({ width, height });
    }
    function onEnd(ev: PointerEvent) {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    handle.addEventListener("pointercancel", onEnd);
  }, []);

  // If initialPlotlyFigure was passed, it was rendered from exactly
  // initialBody — draftFromRequestBody/buildRequestBody round-trip losslessly
  // (see chart-spec.test.ts), so the key computed from the freshly-seeded
  // draft here matches the key that figure was actually rendered under.
  // Seeding renderedFor with it means isPreviewCurrent is true from the
  // very first render, no network round-trip needed just to reopen and look.
  const [previewFigure, setPreviewFigure] = useState<PlotlyFigure | null>(initialPlotlyFigure);
  const [renderedFor, setRenderedFor] = useState<string | null>(() =>
    initialPlotlyFigure ? JSON.stringify(buildRequestBody(draft, "plotly-json")) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const requestBody = buildRequestBody(draft, "plotly-json");
  const currentKey = JSON.stringify(requestBody);
  const hasData = draft.data.some((row) => Object.values(row).some((v) => v !== "" && v !== undefined));
  const isPreviewCurrent = renderedFor === currentKey && previewFigure !== null;

  useEffect(() => {
    if (!hasData) return;
    if (currentKey === renderedFor) return; // already have this exact spec rendered — nothing to do
    const controller = new AbortController();
    const keyAtRequest = currentKey;
    const timer = setTimeout(() => {
      setLoading(true);
      renderChart(buildRequestBody(draft, "plotly-json"), controller.signal)
        .then((result) => {
          if (result.format !== "plotly-json") return;
          setPreviewFigure(result.plotly as PlotlyFigure);
          setRenderedFor(keyAtRequest);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name !== "AbortError") setError(err.message);
        })
        .finally(() => setLoading(false));
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  function setChartType(chartType: ChartSlug) {
    // Style/color fields carry over (they mean the same thing across chart
    // types); data/extra reset to that chart type's own shape/defaults —
    // carrying over e.g. a gantt row into a scatter row would just be
    // silently-wrong data, not a helpful head start.
    const next = defaultDraft(chartType);
    setDraft({
      ...next,
      title: draft.title,
      showTitle: draft.showTitle,
      colors: {},
      palette: draft.palette,
      backgroundColor: draft.backgroundColor,
      gridColor: draft.gridColor,
    });
  }

  const categoryKey = categoryKeyFor(def.rowShape);
  const categories = categoryKey
    ? Array.from(new Set(draft.data.map((row) => String(row[categoryKey] ?? "")).filter(Boolean)))
    : [];

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const [interactiveResult, staticResult] = await Promise.all([
        renderChart(buildRequestBody(draft, "plotly-json")),
        renderChart(buildRequestBody(draft, "png")),
      ]);
      if (interactiveResult.format !== "plotly-json" || staticResult.format === "plotly-json") {
        throw new Error("unexpected render result shape");
      }
      const plotlyJson = JSON.stringify(interactiveResult.plotly);
      const dataUrl = `data:image/png;base64,${staticResult.dataBase64}`;
      onSave(buildRequestBody(draft, "plotly-json"), plotlyJson, dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      className="flex h-[85vh] w-[85vw] min-h-[420px] min-w-[720px] max-h-[95vh] max-w-[95vw] flex-col overflow-hidden rounded-2xl sm:max-w-[95vw]"
      ref={dialogRef}
      style={customSize ? { width: customSize.width, height: customSize.height } : undefined}
      // A misclick just outside the dialog (easy to do with a panel this
      // large) used to close it outright and discard whatever had just been
      // configured — including a CSV import, which has no "undo" once the
      // dialog is gone. Only Cancel/Save/Esc/the X button dismiss it now.
      onPointerDownOutside={(e) => e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-40 shrink-0 overflow-y-auto border-r pr-2">
          {CHART_GROUPS.map(({ group, slugs }) => (
            <div className="mb-3" key={group}>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{t(`groups.${group}` as never)}</div>
              {slugs.map((slug) => (
                <button
                  className={`block w-full rounded-2xl px-2 py-1 text-left text-sm hover:bg-accent ${
                    draft.chartType === slug ? "bg-accent font-medium" : ""
                  }`}
                  key={slug}
                  onClick={() => setChartType(slug)}
                  type="button"
                >
                  {t(`types.${CHART_DEFS[slug].labelKey}` as never)}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex w-[400px] shrink-0 flex-col gap-4 overflow-y-auto pr-1">
          <Tabs defaultValue="data">
            <TabsList>
              <TabsTrigger value="data">{t("tabData")}</TabsTrigger>
              <TabsTrigger value="labels">{t("tabLabels")}</TabsTrigger>
              <TabsTrigger value="style">{t("tabStyle")}</TabsTrigger>
            </TabsList>

            <TabsContent value="data">
              <ChartDataTable
                data={draft.data}
                onDataChange={(data) => setDraft({ ...draft, data })}
                onVarsChange={(vars) => setDraft({ ...draft, vars })}
                rowShape={def.rowShape}
                varsOptions={def.varsOptions}
                vars={draft.vars}
              />
            </TabsContent>

            <TabsContent className="flex flex-col gap-5" value="labels">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t("fields.title")}</span>
                  <label className="flex items-center gap-2 text-xs">
                    {t("fields.showTitle")}
                    <Switch checked={draft.showTitle} onCheckedChange={(v) => setDraft({ ...draft, showTitle: v })} />
                  </label>
                </div>
                <input
                  className="h-8 w-full rounded-2xl border bg-transparent px-3 text-sm outline-none focus:bg-accent"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  value={draft.title}
                />
                <MathLabelPreview value={draft.title} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("fields.xLabel")}</span>
                    <span className="flex items-center gap-1.5">
                      {t("fields.xLabelPositionRight")}
                      <Switch
                        checked={draft.xLabelPosition === "right"}
                        onCheckedChange={(v) => setDraft({ ...draft, xLabelPosition: v ? "right" : "center" })}
                      />
                    </span>
                  </div>
                  <input
                    className="h-8 w-full rounded-2xl border bg-transparent px-3 text-sm outline-none focus:bg-accent"
                    onChange={(e) => setDraft({ ...draft, xLabel: e.target.value })}
                    value={draft.xLabel}
                  />
                  <MathLabelPreview value={draft.xLabel} />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("fields.yLabel")}</span>
                    <span className="flex items-center gap-1.5">
                      {t("fields.yLabelPositionTop")}
                      <Switch
                        checked={draft.yLabelPosition === "top"}
                        onCheckedChange={(v) => setDraft({ ...draft, yLabelPosition: v ? "top" : "center" })}
                      />
                    </span>
                  </div>
                  <input
                    className="h-8 w-full rounded-2xl border bg-transparent px-3 text-sm outline-none focus:bg-accent"
                    onChange={(e) => setDraft({ ...draft, yLabel: e.target.value })}
                    value={draft.yLabel}
                  />
                  <MathLabelPreview value={draft.yLabel} />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
                <label className="flex items-center gap-1.5">
                  {t("fields.showLegend")}
                  <Switch checked={draft.showLegend} onCheckedChange={(v) => setDraft({ ...draft, showLegend: v })} />
                </label>
                <label className="flex items-center gap-1.5">
                  {t("fields.showGrid")}
                  <Switch checked={draft.showGrid} onCheckedChange={(v) => setDraft({ ...draft, showGrid: v })} />
                </label>
                <label className="flex items-center gap-1.5">
                  {t("fields.squareGrid")}
                  <Switch checked={draft.squareGrid} onCheckedChange={(v) => setDraft({ ...draft, squareGrid: v })} />
                </label>
              </div>

              {/* Independent per-side border lines — Plotly's own axis
                  mirror can't express e.g. "top on, bottom off" (see
                  render.py's build_figure comment), so each side gets its
                  own toggle rather than one combined "border" switch. */}
              <div className="grid grid-cols-4 gap-2 px-1 py-1 text-xs">
                {(["showBorderTop", "showBorderBottom", "showBorderLeft", "showBorderRight"] as const).map((key) => (
                  <label className="flex items-center gap-1.5" key={key}>
                    {t(`fields.${key}` as never)}
                    <Switch checked={draft[key]} onCheckedChange={(v) => setDraft({ ...draft, [key]: v })} />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {(["xMin", "xMax", "yMin", "yMax", "gridStep"] as const).map((key) => (
                  <label className="flex flex-col gap-1 text-[11px]" key={key}>
                    <span className="leading-tight text-muted-foreground">{t(`fields.${key}` as never)}</span>
                    <input
                      className="h-8 w-full rounded-2xl border bg-transparent px-2 text-xs outline-none focus:bg-accent"
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      value={draft[key]}
                    />
                  </label>
                ))}
              </div>
            </TabsContent>

            <TabsContent className="flex flex-col gap-4" value="style">
              <ChartExtraFields
                fields={def.fields}
                onChange={(key, value) => setDraft({ ...draft, extra: { ...draft.extra, [key]: value } })}
                values={draft.extra}
              />

              <ChartColorControls
                backgroundColor={draft.backgroundColor}
                categories={categories}
                colors={draft.colors}
                gridColor={draft.gridColor}
                onBackgroundColorChange={(backgroundColor) => setDraft({ ...draft, backgroundColor })}
                onColorsChange={(colors) => setDraft({ ...draft, colors })}
                onGridColorChange={(gridColor) => setDraft({ ...draft, gridColor })}
                onPaletteChange={(palette) => setDraft({ ...draft, palette })}
                palette={draft.palette}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview lives outside the Tabs (a sibling, not a TabsContent) so
            it stays visible across all three tabs instead of disappearing
            whenever the user switches to "style" or "data" — the whole
            point of putting it beside the settings instead of below them. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("previewTitle")}</span>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border bg-muted/20 p-4">
            {isPreviewCurrent && previewFigure ? (
              // aspect-[4/3] matches render.py's kaleido export canvas
              // (1000x750) exactly — a square-grid chart's scaleanchor
              // autoranges to fill whatever canvas shape it's given, so a
              // preview canvas shaped differently from the export canvas
              // renders visibly different axis proportions from the same
              // spec (reported as "PDF height wrong" vs this live preview).
              // Sized off h-full + max-w-full (not w-full): this column's
              // height is bounded by the dialog's own flex row, so letting
              // the aspect ratio derive from height (clamped by width when
              // the column is narrow) can never overflow it, unlike driving
              // the ratio off width alone.
              <div className="aspect-[4/3] h-full max-w-full">
                <ChartPlotlyView figure={previewFigure} />
              </div>
            ) : loading ? (
              <span className="text-sm text-muted-foreground">{t("previewLoading")}</span>
            ) : error ? (
              <span className="p-4 text-sm text-destructive">{error}</span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("previewEmpty")}</span>
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button className="rounded-2xl" onClick={onCancel} variant="outline">
          {t("cancel")}
        </Button>
        <Button className="rounded-2xl" disabled={saving || !hasData} onClick={handleSave}>
          {saving ? t("previewLoading") : t("save")}
        </Button>
      </DialogFooter>

      {/* No visible icon, same as a real browser/OS window corner — just an
          invisible hit-zone tucked into the rounded-2xl corner (same inset
          as DialogPrimitive.Close's own top-2/right-2 elsewhere in this
          file) that shows the resize cursor on hover. */}
      <div
        aria-label={t("resizeDialog")}
        className="absolute right-1.5 bottom-1.5 size-6 cursor-nwse-resize touch-none"
        onPointerDown={handleResizeStart}
        role="button"
        title={t("resizeDialog")}
      />
    </DialogContent>
  );
}
