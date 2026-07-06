"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import { renderFunctionPlot } from "@/lib/function-plot-render";
import { defaultCurveStyle, MAX_CURVES } from "@/lib/function-plot-defaults";
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
  const [draft, setDraft] = useState<FunctionPlotSpec>(initialSpec);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const controller = new AbortController();
      setLoading(true);
      renderFunctionPlot(draft, controller.signal)
        .then((svg) => {
          setPreviewSvg(svg);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name !== "AbortError") {
            setError(err.message);
          }
        })
        .finally(() => setLoading(false));
      return () => controller.abort();
    }, 500);
    return () => clearTimeout(timer);
    // Re-run whenever the draft's actual content changes; JSON.stringify
    // keeps this a single dependency instead of enumerating every field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(draft)]);

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

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          {draft.curves.map((curve, index) => (
            <div className="flex items-center gap-2" key={index}>
              <Input
                onChange={(event) => updateCurve(index, { formula: event.target.value })}
                placeholder={t("curveFormula")}
                value={curve.formula}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label={t("curveColor")}
                    className="size-8 shrink-0 rounded border"
                    onMouseDown={(event) => event.stopPropagation()}
                    style={{ backgroundColor: curve.color }}
                    type="button"
                  />
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
          ))}
          <Button
            disabled={draft.curves.length >= MAX_CURVES}
            onClick={addCurve}
            size="sm"
            variant="outline"
          >
            {draft.curves.length >= MAX_CURVES ? t("curveLimitReached") : t("addCurve")}
          </Button>
          <div className="flex items-center gap-2">
            <Input
              onChange={(event) => setDraft((prev) => ({ ...prev, xMin: Number(event.target.value) }))}
              placeholder={t("xRangeMin")}
              type="number"
              value={draft.xMin}
            />
            <Input
              onChange={(event) => setDraft((prev) => ({ ...prev, xMax: Number(event.target.value) }))}
              placeholder={t("xRangeMax")}
              type="number"
              value={draft.xMax}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.showGridlines}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showGridlines: checked }))}
            />
            {t("showGridlines")}
          </label>
        </div>
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded border p-2">
          {previewSvg ? (
            <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
          ) : loading ? (
            <span className="text-muted-foreground text-sm">{t("previewLoading")}</span>
          ) : null}
          {error ? <p className="text-destructive text-sm">{t("previewError")}</p> : null}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onCancel} variant="ghost">
          {t("cancel")}
        </Button>
        <Button disabled={!previewSvg} onClick={() => previewSvg && onSave(draft, previewSvg)}>
          {t("save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
