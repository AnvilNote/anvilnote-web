"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import CodeMirror, { keymap, Prec } from "@uiw/react-codemirror";
import { MoreVertical, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ColorPicker,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/ui/color-picker";
import {
  CURVE_PREVIEW_LIMIT,
  MAX_CURVES_BY_MODE,
  defaultCurve,
} from "@/lib/function-plot-defaults";
import { renderFunctionPlot } from "@/lib/function-plot-render";
import { renderPdfBase64ToPng } from "@/lib/tiptap/pdf-thumbnail";
import { cn } from "@/lib/utils";
import type {
  AxisBound,
  AxisRange,
  FunctionPlotCurve,
  FunctionPlotSpec,
} from "@/lib/tiptap/function-plot";

export type FunctionPlotDialogProps = {
  open: boolean;
  initialSpec: FunctionPlotSpec;
  onOpenChange: (open: boolean) => void;
  onSave: (spec: FunctionPlotSpec, pdf: string, preview: string) => void;
};

export function FunctionPlotDialog({
  open,
  initialSpec,
  onOpenChange,
  onSave,
}: FunctionPlotDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <FunctionPlotForm
          initialSpec={initialSpec}
          onCancel={() => onOpenChange(false)}
          onSave={(spec, pdf, preview) => {
            onSave(spec, pdf, preview);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function parseAxisBound(raw: string): AxisBound | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "inf" || value === "infinity") return "Infinity";
  if (value === "-inf" || value === "-infinity") return "-Infinity";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAxisBound(bound: AxisBound | undefined): string {
  if (bound === undefined) return "";
  if (bound === "Infinity") return "inf";
  if (bound === "-Infinity") return "-inf";
  return String(bound);
}

function updateRangeBound(
  range: AxisRange,
  index: 0 | 1,
  raw: string,
): AxisRange {
  const parsed = parseAxisBound(raw);
  if (parsed === null) return null;
  const fallback: [AxisBound, AxisBound] = [-10, 10];
  const next = [...(range ?? fallback)] as [AxisBound, AxisBound];
  next[index] = parsed;
  return next;
}

// The preview pane's small pill inputs show their own translated label as
// a placeholder (xLabel/yLabel/xRangeMin/...), so a single hardcoded width
// clips in any locale whose string is longer than the shortest one it was
// tuned for (e.g. Russian's "Подпись оси x" vs zh-TW's "x 軸標籤"). CJK/Thai
// glyphs render roughly twice as wide as Latin/Cyrillic ones at this text
// size, so each is weighted accordingly rather than using a flat per-char
// width.
const WIDE_CHAR_RE =
  /[\u0E00-\u0E7F\u1100-\u11FF\u2E80-\u9FFF\uAC00-\uD7A3\uF900-\uFAFF\uFF00-\uFFEF]/;

function pillInputWidth(label: string): number {
  let width = 0;
  for (const character of label) {
    width += WIDE_CHAR_RE.test(character) ? 13 : 7;
  }
  return Math.max(56, Math.round(width) + 28);
}

function FunctionPlotForm({
  initialSpec,
  onCancel,
  onSave,
}: {
  initialSpec: FunctionPlotSpec;
  onCancel: () => void;
  onSave: (spec: FunctionPlotSpec, pdf: string, preview: string) => void;
}) {
  const t = useTranslations("editor.functionPlot");
  const { resolvedTheme } = useTheme();
  const [draft, setDraft] = useState(initialSpec);
  const [previewPng, setPreviewPng] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [renderedFor, setRenderedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllCurves, setShowAllCurves] = useState(false);
  const [openColorCurve, setOpenColorCurve] = useState<number | null>(null);

  const maxCurves = MAX_CURVES_BY_MODE[draft.mode];
  const is3d =
    draft.mode === "3d-surface" || draft.mode === "3d-contour";
  const hasGridAndTicks = draft.mode !== "3d-surface";
  const hasAnyExpr = draft.curves.some((curve) => curve.expr.trim());
  const currentDraftKey = JSON.stringify(draft);
  const isPreviewCurrent =
    hasAnyExpr && renderedFor === currentDraftKey && !!previewPng && !!pdfBase64;

  const expressionExtensions = useMemo(
    () => [
      Prec.highest(
        keymap.of([
          { key: "Enter", run: () => true },
          { key: "Shift-Enter", run: () => true },
        ]),
      ),
    ],
    [],
  );

  function updateCurve(index: number, patch: Partial<FunctionPlotCurve>) {
    setDraft((previous) => ({
      ...previous,
      curves: previous.curves.map((curve, curveIndex) =>
        curveIndex === index ? { ...curve, ...patch } : curve,
      ),
    }));
  }

  function changeMode(mode: FunctionPlotSpec["mode"]) {
    setDraft((previous) => ({
      ...previous,
      mode,
      curves: previous.curves.slice(0, MAX_CURVES_BY_MODE[mode]),
    }));
    setShowAllCurves(false);
  }

  // Takes an explicit spec (rather than always reading the `draft` state
  // closure) so a toggle's onCheckedChange can redraw with the value it
  // JUST computed, without waiting a render for setDraft to land first —
  // reading `draft` here would still see the PREVIOUS value in that same
  // event handler.
  async function redrawWith(nextSpec: FunctionPlotSpec) {
    if (!nextSpec.curves.some((curve) => curve.expr.trim()) || loading) return;
    setLoading(true);
    setError(null);
    const draftKey = JSON.stringify(nextSpec);
    try {
      const pdf = await renderFunctionPlot(nextSpec);
      const preview = await renderPdfBase64ToPng(pdf);
      setPdfBase64(pdf);
      setPreviewPng(preview);
      setRenderedFor(draftKey);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : t("previewError");
      setError(message);
      toast.warning(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRedraw() {
    return redrawWith(draft);
  }

  const visibleCurves = showAllCurves
    ? draft.curves
    : draft.curves.slice(0, CURVE_PREVIEW_LIMIT);
  const hiddenCurveCount = draft.curves.length - visibleCurves.length;

  return (
    <DialogContent
      className="sm:max-w-6xl"
      onInteractOutside={(event) => {
        // Editing a plot is a draft-producing workflow. Radix Select renders
        // its menu in a portal, so clicking outside that menu can otherwise
        // bubble into Dialog's outside-interaction handler and dismiss the
        // entire plot dialog along with the selector. Keep the draft open;
        // users close explicitly with Cancel, ×, or Escape.
        event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:h-120 sm:grid-cols-2">
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="function-plot-mode"
            >
              {t("mode")}
            </label>
            <Select
              onValueChange={(value) =>
                changeMode(value as FunctionPlotSpec["mode"])
              }
              value={draft.mode}
            >
              <SelectTrigger
                aria-label={t("mode")}
                id="function-plot-mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">{t("modes.1d")}</SelectItem>
                <SelectItem value="2d">{t("modes.2d")}</SelectItem>
                <SelectItem value="3d-surface">
                  {t("modes.3d-surface")}
                </SelectItem>
                <SelectItem value="3d-contour">
                  {t("modes.3d-contour")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desmos-style expression list: a single bordered card, one row
              per curve (color cell / expression / "..." menu), with the
              add-row folded into the same card instead of a separate
              button underneath. */}
          <div className="divide-y overflow-hidden rounded-xl border">
            {visibleCurves.map((curve, index) => (
              <div className="flex items-stretch" key={index}>
                {/* One combined popover per row (Desmos-style): the color
                    cell opens both the color picker AND (2D/3D only) the
                    curve's own name/label field, rather than a separate
                    always-visible dropdown next to it. 1D rows only ever
                    plot intervals, which the funcs backend never labels, so
                    the label field is omitted there entirely. */}
                <Popover
                  onOpenChange={(isOpen) =>
                    setOpenColorCurve(isOpen ? index : null)
                  }
                  open={openColorCurve === index}
                >
                  <PopoverTrigger asChild>
                    <button
                      aria-label={t("curveColor")}
                      className="flex w-11 shrink-0 items-center justify-center bg-muted/40 hover:bg-muted"
                      type="button"
                    >
                      <span
                        className="size-5 shrink-0 rounded-full border"
                        style={{ backgroundColor: curve.color }}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64"
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <ColorPicker
                      className="gap-3"
                      onChange={(rgba) => {
                        const [red, green, blue] = rgba as [
                          number,
                          number,
                          number,
                          number,
                        ];
                        const color = `#${[red, green, blue]
                          .map((channel) =>
                            Math.round(channel).toString(16).padStart(2, "0"),
                          )
                          .join("")}`;
                        updateCurve(index, { color });
                      }}
                      value={curve.color}
                    >
                      <ColorPickerSelection className="h-32" />
                      <ColorPickerHue />
                      <div className="flex items-center gap-2">
                        <ColorPickerEyeDropper />
                        <ColorPickerOutput />
                      </div>
                      <ColorPickerFormat />
                    </ColorPicker>
                  </PopoverContent>
                </Popover>
                <div className="flex min-w-0 flex-1 items-center [&_.cm-content]:!px-3 [&_.cm-content]:!py-1.5 [&_.cm-editor]:!bg-transparent [&_.cm-editor.cm-focused]:!outline-none [&_.cm-gutters]:hidden [&_.cm-line]:!py-0 [&_.cm-scroller]:font-mono">
                  <CodeMirror
                    autoFocus={index === 0}
                    basicSetup={{
                      lineNumbers: false,
                      foldGutter: false,
                      highlightActiveLine: false,
                    }}
                    extensions={expressionExtensions}
                    onChange={(value) => updateCurve(index, { expr: value })}
                    placeholder={t(
                      `curveExpressionPlaceholders.${draft.mode}`,
                    )}
                    theme={resolvedTheme === "dark" ? "dark" : "light"}
                    value={curve.expr}
                    width="100%"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={t("removeCurve")}
                      className="flex w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                      type="button"
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {draft.mode !== "1d" ? (
                      <>
                        {/* A single row, not a hover flyout: the dialog is
                            narrow enough that a submenu flying out from the
                            "..." trigger (near the row's own right edge) had
                            nowhere to go but back over the menu itself.
                            Left = a selector button for "no label"; right =
                            free-text name (typing anything counts as
                            picking "custom"). Neither is a DropdownMenuItem,
                            since those close the whole menu on click/type. */}
                        <div className="space-y-1.5 p-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("curveMarkerLabel")}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              aria-pressed={curve.label === null}
                              className={cn(
                                "flex h-8 shrink-0 items-center justify-center rounded-md border px-2 text-xs",
                                curve.label === null
                                  ? "border-foreground/30 bg-accent"
                                  : "text-muted-foreground hover:bg-accent",
                              )}
                              onClick={() => updateCurve(index, { label: null })}
                              type="button"
                            >
                              {t("curveMarkerNone")}
                            </button>
                            <Input
                              className="h-8"
                              id={`function-plot-label-${index}`}
                              onChange={(event) =>
                                updateCurve(index, {
                                  label: event.target.value ? event.target.value : null,
                                })
                              }
                              onKeyDown={(event) => event.stopPropagation()}
                              placeholder={t("curveMarkerPlaceholder")}
                              value={curve.label ?? ""}
                            />
                          </div>
                        </div>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem
                      disabled={draft.curves.length <= 1}
                      onSelect={() =>
                        setDraft((previous) => ({
                          ...previous,
                          curves: previous.curves.filter(
                            (_, curveIndex) => curveIndex !== index,
                          ),
                        }))
                      }
                      variant="destructive"
                    >
                      <Trash2 className="size-4" />
                      {t("removeCurve")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            <button
              className="group flex w-full items-stretch text-left text-sm text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={draft.curves.length >= maxCurves}
              onClick={() =>
                setDraft((previous) => ({
                  ...previous,
                  curves: [...previous.curves, defaultCurve(previous.curves.length)],
                }))
              }
              type="button"
            >
              {/* Both cells share the SAME hover token (group-hover:bg-muted)
                  so the whole row visibly highlights as one continuous bar —
                  the plus cell's own permanent bg-muted/40 made a plain
                  hover:bg-accent on the button invisible-by-comparison there
                  (going 40%-opacity muted -> accent barely differs), while
                  the text cell (fully transparent at rest) looked entirely
                  unlit next to it. */}
              <span className="flex w-11 shrink-0 items-center justify-center bg-muted/40 group-hover:bg-muted">
                <Plus className="size-4" />
              </span>
              <span className="flex flex-1 items-center px-3 py-2 group-hover:bg-muted">
                {draft.curves.length >= maxCurves
                  ? t("curveLimitReached")
                  : draft.mode === "1d"
                    ? t("addInterval")
                    : t("addFunction")}
              </span>
            </button>
          </div>

          {hiddenCurveCount > 0 ? (
            <Button
              onClick={() => setShowAllCurves(true)}
              size="sm"
              variant="ghost"
            >
              {t("showMoreCurves", { count: hiddenCurveCount })}
            </Button>
          ) : showAllCurves &&
            draft.curves.length > CURVE_PREVIEW_LIMIT ? (
            <Button
              onClick={() => setShowAllCurves(false)}
              size="sm"
              variant="ghost"
            >
              {t("showFewerCurves")}
            </Button>
          ) : null}

          <Button
            disabled={!hasAnyExpr || loading}
            onClick={handleRedraw}
            variant="secondary"
          >
            {loading ? t("redrawing") : t("redraw")}
          </Button>
        </div>

        <div className="relative flex h-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md border p-2">
          {/* Top bar: grid/ticks/color-mode toggles now live over the
              preview pane itself, matching stats-chart-dialog's own
              overlay convention, instead of sitting as standalone form
              fields in the left column. */}
          <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {hasGridAndTicks ? (
              <>
                <label className="flex items-center gap-1.5">
                  <Switch
                    checked={draft.grid.enabled}
                    className="scale-90"
                    onCheckedChange={(enabled) => {
                      const next = { ...draft, grid: { ...draft.grid, enabled } };
                      setDraft(next);
                      redrawWith(next);
                    }}
                  />
                  {t("showGrid")}
                </label>
                {draft.grid.enabled ? (
                  <input
                    aria-label={t("gridStep")}
                    className="rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                    min={0.01}
                    onChange={(event) => {
                      const step = Number(event.target.value);
                      if (step > 0) {
                        setDraft((previous) => ({
                          ...previous,
                          grid: { ...previous.grid, step },
                        }));
                      }
                    }}
                    step="any"
                    style={{ width: pillInputWidth(t("gridStep")) }}
                    type="number"
                    value={draft.grid.step}
                  />
                ) : null}
                <label className="flex items-center gap-1.5">
                  <Switch
                    checked={draft.ticks.enabled}
                    className="scale-90"
                    onCheckedChange={(enabled) => {
                      const next = { ...draft, ticks: { enabled } };
                      setDraft(next);
                      redrawWith(next);
                    }}
                  />
                  {t("showTicks")}
                </label>
              </>
            ) : null}
            {is3d ? (
              <label className="flex items-center gap-1.5">
                <Switch
                  checked={draft.colorMode === "colormap"}
                  className="scale-90"
                  onCheckedChange={(checked) => {
                    const next: FunctionPlotSpec = {
                      ...draft,
                      colorMode: checked ? "colormap" : "bw",
                    };
                    setDraft(next);
                    redrawWith(next);
                  }}
                />
                {t("colorModeColormap")}
              </label>
            ) : null}
          </div>

          {isPreviewCurrent && previewPng ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={t("previewAlt")}
              className="max-h-full max-w-full object-contain"
              src={previewPng}
            />
          ) : loading ? (
            <span className="text-sm text-muted-foreground">
              {t("previewLoading")}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t("previewEmpty")}
            </span>
          )}
          {error ? (
            <p className="max-w-full break-words text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {/* Bottom bar: axis labels (left) and range bounds (right) --
              same left/right split convention as stats-chart-dialog's own
              bottom bar. */}
          <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label={t("xLabel")}
                className="rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    axis: { ...previous.axis, xLabel: event.target.value },
                  }))
                }
                placeholder={t("xLabel")}
                style={{ width: pillInputWidth(t("xLabel")) }}
                value={draft.axis.xLabel}
              />
              <input
                aria-label={t("yLabel")}
                className="rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    axis: { ...previous.axis, yLabel: event.target.value },
                  }))
                }
                placeholder={t("yLabel")}
                style={{ width: pillInputWidth(t("yLabel")) }}
                value={draft.axis.yLabel}
              />
              {is3d ? (
                <input
                  aria-label={t("zLabel")}
                  className="rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      axis: { ...previous.axis, zLabel: event.target.value },
                    }))
                  }
                  placeholder={t("zLabel")}
                  style={{ width: pillInputWidth(t("zLabel")) }}
                  value={draft.axis.zLabel}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 bg-background/90 px-2 py-1">
              <input
                aria-label={t("xRangeMin")}
                className="rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    axis: {
                      ...previous.axis,
                      xRange: updateRangeBound(
                        previous.axis.xRange,
                        0,
                        event.target.value,
                      ),
                    },
                  }))
                }
                placeholder={t("xRangeMin")}
                style={{ width: pillInputWidth(t("xRangeMin")) }}
                value={formatAxisBound(draft.axis.xRange?.[0])}
              />
              <input
                aria-label={t("xRangeMax")}
                className="rounded-lg border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:bg-accent"
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    axis: {
                      ...previous.axis,
                      xRange: updateRangeBound(
                        previous.axis.xRange,
                        1,
                        event.target.value,
                      ),
                    },
                  }))
                }
                placeholder={t("xRangeMax")}
                style={{ width: pillInputWidth(t("xRangeMax")) }}
                value={formatAxisBound(draft.axis.xRange?.[1])}
              />
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onCancel} variant="ghost">
          {t("cancel")}
        </Button>
        <Button
          disabled={!isPreviewCurrent}
          onClick={() => {
            if (isPreviewCurrent && pdfBase64 && previewPng) {
              onSave(draft, pdfBase64, previewPng);
            }
          }}
        >
          {t("save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
