"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import CodeMirror, { keymap, Prec } from "@uiw/react-codemirror";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import { renderFunctionPlot } from "@/lib/function-plot-render";
import {
  CURVE_PREVIEW_LIMIT,
  DASH_CYCLE,
  type DashStyle,
  defaultCurveStyle,
  MAX_CURVES,
  MAX_THICKNESS,
  MIN_THICKNESS,
} from "@/lib/function-plot-defaults";
import { parseNumericInput, numericInputValue } from "@/lib/numeric-input";
import type { FunctionPlotCurve, FunctionPlotSpec } from "@/lib/tiptap/function-plot";

export type FunctionPlotDialogProps = {
  open: boolean;
  initialSpec: FunctionPlotSpec;
  onOpenChange: (open: boolean) => void;
  onSave: (spec: FunctionPlotSpec, svg: string) => void;
};

export function FunctionPlotDialog({
  open,
  initialSpec,
  onOpenChange,
  onSave,
}: FunctionPlotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <FunctionPlotForm
          initialSpec={initialSpec}
          onCancel={() => onOpenChange(false)}
          onSave={(spec, svg) => {
            onSave(spec, svg);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function FunctionPlotForm({
  initialSpec,
  onCancel,
  onSave,
}: {
  initialSpec: FunctionPlotSpec;
  onCancel: () => void;
  onSave: (spec: FunctionPlotSpec, svg: string) => void;
}) {
  const t = useTranslations("editor.functionPlot");
  const { resolvedTheme } = useTheme();
  const [draft, setDraft] = useState<FunctionPlotSpec>(initialSpec);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  // Tracks which draft previewSvg was actually rendered for, as a JSON key.
  // Without this, editing a formula/curve and clicking Save inside the
  // 500ms debounce window (or before the in-flight request resolves) would
  // save the CURRENT draft paired with the PREVIOUS draft's rendered SVG —
  // a mismatch that then round-trips silently into the document and PDF
  // export, since both the NodeView and the renderer trust the cached svg
  // attr unconditionally.
  const [renderedFor, setRenderedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Caps the visible curve rows at CURVE_PREVIEW_LIMIT (matches
  // stats-chart-dialog.tsx's VISIBLE_ROW_LIMIT pattern) — "Show N more"
  // reveals the rest in a scrollable list rather than growing the modal
  // unbounded up to MAX_CURVES (6).
  const [showAllCurves, setShowAllCurves] = useState(false);
  // A freshly-inserted node's only curve starts with formula: "" (see
  // function-plot.ts's defaultCurves()) — derived fresh every render (not
  // effect-set state) so the "nothing typed yet" display below doesn't
  // depend on clearing previewSvg/error from inside an effect, which
  // react-hooks/set-state-in-effect flags as a cascading-render risk.
  const hasFormula = draft.curves.some((curve) => curve.formula.trim());
  const currentDraftKey = JSON.stringify(draft);
  const isPreviewCurrent = hasFormula && renderedFor === currentDraftKey;

  // A formula is one expression, not a document — block Enter/Shift-Enter
  // from inserting a newline (CodeMirror's default) so a stray keystroke
  // can't silently turn "sin(x)" into a two-line value. The schema's
  // formula whitelist regex includes `\s`, which matches newlines too, so
  // this wouldn't even fail validation — it would just break the Typst
  // compile with a confusing error, which stripping the shortcut here
  // avoids entirely. Wrapped in Prec.highest: CodeMirror's basicSetup
  // (passed separately below) contributes its own Enter binding
  // (insertNewlineAndIndent) via its own keymap.of(...); without an
  // explicit precedence bump, that default keeps winning regardless of
  // which extensions-array position this one is added at.
  const formulaExtensions = useMemo(
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

  useEffect(() => {
    // Don't attempt a render at all until the user has actually typed a
    // formula — calling the API with an all-empty curve list would just
    // burn a round-trip to immediately show "Couldn't render" before the
    // user has done anything. No cleanup needed for this branch: there's
    // no pending timer/request to cancel, and the JSX below already hides
    // stale previewSvg/error via the same `hasFormula` check instead of
    // clearing that state here.
    if (!hasFormula) {
      return;
    }

    // The AbortController is created here, in the effect body — NOT inside
    // the setTimeout callback — so the effect's own cleanup can reach it.
    // A controller created inside the timeout callback would have its
    // would-be "abort on cleanup" return value silently discarded by
    // setTimeout (it doesn't call or store a callback's return value),
    // so an in-flight request from a stale keystroke would never actually
    // be cancelled and could resolve after a newer one, overwriting the
    // fresher preview with stale data.
    const controller = new AbortController();
    const draftKeyAtRequestTime = currentDraftKey;
    const timer = setTimeout(() => {
      setLoading(true);
      renderFunctionPlot(draft, controller.signal)
        .then((svg) => {
          setPreviewSvg(svg);
          setRenderedFor(draftKeyAtRequestTime);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name !== "AbortError") {
            setError(err.message);
          }
        })
        .finally(() => setLoading(false));
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Re-run whenever the draft's actual content changes; JSON.stringify
    // keeps this a single dependency instead of enumerating every field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraftKey]);

  function updateCurve(index: number, patch: Partial<FunctionPlotCurve>) {
    setDraft((prev) => ({
      ...prev,
      curves: prev.curves.map((curve, i) => (i === index ? { ...curve, ...patch } : curve)),
    }));
  }

  function addCurve() {
    setDraft((prev) =>
      prev.curves.length >= MAX_CURVES
        ? prev
        : {
            ...prev,
            curves: [...prev.curves, { formula: "", ...defaultCurveStyle(prev.curves.length) }],
          },
    );
  }

  function removeCurve(index: number) {
    setDraft((prev) => ({ ...prev, curves: prev.curves.filter((_, i) => i !== index) }));
  }

  const visibleCurves = showAllCurves ? draft.curves : draft.curves.slice(0, CURVE_PREVIEW_LIMIT);
  const hiddenCurveCount = draft.curves.length - visibleCurves.length;

  function curveRow(curve: FunctionPlotCurve, index: number) {
    return (
      // items-end, not items-center: the formula field has a label above
      // it (taller than the bare remove button), so centering the row
      // misaligns the button upward relative to the input. Aligning to
      // the bottom edge instead lines up the input and remove button
      // (size-8) on the same row.
      <div className="flex items-end gap-2" key={index}>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`curve-formula-${index}`}
            >
              {t("curveFormula")}
            </label>
            {index === 0 ? (
              <a
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                href="https://typst.app/docs/reference/foundations/calc/"
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("syntaxHelp")}
              </a>
            ) : null}
          </div>
          <div
            className="overflow-hidden rounded-md border text-sm [&_.cm-editor]:rounded-md [&_.cm-scroller]:font-mono"
            id={`curve-formula-${index}`}
          >
            <CodeMirror
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
              extensions={formulaExtensions}
              height="32px"
              onChange={(value) => updateCurve(index, { formula: value })}
              placeholder={t("curveFormulaPlaceholder")}
              theme={resolvedTheme === "dark" ? "dark" : "light"}
              value={curve.formula}
            />
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label={t("curveColor")}
              className="flex h-8 w-28 shrink-0 items-center gap-1.5 rounded border px-2 hover:bg-accent"
              onMouseDown={(event) => event.stopPropagation()}
              type="button"
            >
              <span
                className="size-4 shrink-0 rounded-full border"
                style={{ backgroundColor: curve.color }}
              />
              <span className="truncate font-mono text-xs text-muted-foreground">{curve.color}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64" onMouseDown={(event) => event.stopPropagation()}>
            <ColorPicker
              className="gap-3"
              onChange={(rgba) => {
                const [r, g, b] = rgba as [number, number, number, number];
                const hex = `#${[r, g, b]
                  .map((c) => Math.round(c).toString(16).padStart(2, "0"))
                  .join("")}`;
                updateCurve(index, { color: hex });
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
        <Input
          aria-label={t("curveThickness")}
          className="h-8 w-16 shrink-0 px-2 text-xs"
          max={MAX_THICKNESS}
          min={MIN_THICKNESS}
          onChange={(event) =>
            updateCurve(index, { thickness: parseNumericInput(event.target.value) })
          }
          step={0.1}
          type="number"
          value={numericInputValue(curve.thickness)}
        />
        <Select
          onValueChange={(value) => updateCurve(index, { dash: value as DashStyle })}
          value={curve.dash}
        >
          <SelectTrigger
            aria-label={t("curveDash")}
            className="h-8 w-24 shrink-0 text-xs"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DASH_CYCLE.map((dash) => (
              <SelectItem className="text-xs" key={dash} value={dash}>
                {t(`dashStyles.${dash}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.curves.length > 1 ? (
          <Button
            aria-label={t("removeCurve")}
            onClick={() => removeCurve(index)}
            size="icon"
            variant="ghost"
          >
            ×
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <DialogContent className="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
      </DialogHeader>
      {/* Fixed height on the two-column row (not just min-height on the
          preview pane) — otherwise the left column's own height grows
          with curve count (color rows are unconditionally listed for
          every curve, not just the visible/capped ones), so the modal
          as a whole would resize every time a curve is added/removed.
          Left column scrolls internally instead; the right column fills
          the same fixed height. */}
      <div className="grid grid-cols-1 gap-4 sm:h-[480px] sm:grid-cols-2">
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {visibleCurves.map((curve, index) => curveRow(curve, index))}
          {hiddenCurveCount > 0 ? (
            <Button onClick={() => setShowAllCurves(true)} size="sm" variant="ghost">
              {t("showMoreCurves", { count: hiddenCurveCount })}
            </Button>
          ) : showAllCurves && draft.curves.length > CURVE_PREVIEW_LIMIT ? (
            <Button onClick={() => setShowAllCurves(false)} size="sm" variant="ghost">
              {t("showFewerCurves")}
            </Button>
          ) : null}
          <Button
            disabled={draft.curves.length >= MAX_CURVES}
            onClick={addCurve}
            size="sm"
            variant="outline"
          >
            {draft.curves.length >= MAX_CURVES ? t("curveLimitReached") : t("addCurve")}
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="function-plot-x-min"
              >
                {t("xRangeMin")}
              </label>
              <Input
                id="function-plot-x-min"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, xMin: parseNumericInput(event.target.value) }))
                }
                placeholder={t("xRangeMin")}
                type="number"
                value={numericInputValue(draft.xMin)}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="function-plot-x-max"
              >
                {t("xRangeMax")}
              </label>
              <Input
                id="function-plot-x-max"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, xMax: parseNumericInput(event.target.value) }))
                }
                placeholder={t("xRangeMax")}
                type="number"
                value={numericInputValue(draft.xMax)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.showGridlines}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showGridlines: checked }))}
            />
            {t("showGridlines")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.showAxisTicks}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showAxisTicks: checked }))}
            />
            {t("showAxisTicks")}
          </label>
        </div>
        <div className="flex h-full flex-col items-center justify-center gap-2 overflow-hidden rounded border p-2 [&_svg]:h-auto [&_svg]:max-w-full">
          {/* Gated on isPreviewCurrent (hasFormula AND renderedFor matches
              the draft on screen), not just previewSvg/error/loading
              directly: this hides a stale render left over from a PREVIOUS
              draft (e.g. mid-debounce after an edit), not just from a
              cleared formula — see the renderedFor comment above.
              Centered both axes: bottom-aligning looked right only when
              axis tick labels were shown (their baseline lines up with
              the box's bottom edge) — with showAxisTicks off there's no
              baseline to align to, so bottom+left anchoring just left a
              large empty gap at the top/right instead. */}
          {isPreviewCurrent && previewSvg ? (
            <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
          ) : hasFormula && loading ? (
            <span className="text-muted-foreground text-sm">{t("previewLoading")}</span>
          ) : null}
          {hasFormula && error ? <p className="text-destructive text-sm">{t("previewError")}</p> : null}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onCancel} variant="ghost">
          {t("cancel")}
        </Button>
        <Button
          disabled={!isPreviewCurrent || !previewSvg}
          onClick={() => isPreviewCurrent && previewSvg && onSave(draft, previewSvg)}
        >
          {t("save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
