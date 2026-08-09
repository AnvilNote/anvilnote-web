"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { COLOR_PALETTES, type ColorPaletteId } from "@/colors/palettes";
import { DEFAULT_COLOR_CYCLE } from "@/lib/chart/chart-registry";

function rgbaToHex(rgba: number[]): string {
  const [r, g, b] = rgba as [number, number, number, number];
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

// Preview only — the server (colors.py's resolve_color) is the actual
// authority on final color; this just gives the user something sensible to
// look at before the next render round-trip.
function previewColor(colors: Record<string, string>, palette: string[], key: string, index: number): string {
  if (colors[key]) return colors[key];
  if (palette.length > 0) return palette[index % palette.length];
  return DEFAULT_COLOR_CYCLE[index % DEFAULT_COLOR_CYCLE.length];
}

// Plotly's own default template values — shown as swatch previews whenever
// backgroundColor/gridColor are unset, so each swatch always reflects what
// the chart actually looks like right now.
const DEFAULT_CHART_BACKGROUND = "#E5ECF6";
const DEFAULT_GRID_COLOR = "#FFFFFF";

function SingleColorSwatch({
  label,
  value,
  defaultValue,
  onChange,
  resetLabel,
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (color: string) => void;
  resetLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button className="flex h-8 w-full items-center gap-1.5 rounded-2xl border px-2" type="button">
            <span className="size-3.5 shrink-0 rounded-full border" style={{ backgroundColor: value || defaultValue }} />
            <span className="font-mono">{value || defaultValue}</span>
            {value ? (
              <span
                aria-label={resetLabel}
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                role="button"
              >
                ×
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 rounded-2xl">
          <ColorPicker className="gap-3" onChange={(rgba) => onChange(rgbaToHex(rgba as number[]))} value={value || defaultValue}>
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
    </label>
  );
}

export type ChartColorControlsProps = {
  categories: string[]; // unique category keys currently present in the data
  colors: Record<string, string>;
  palette: string[];
  onColorsChange: (colors: Record<string, string>) => void;
  onPaletteChange: (palette: string[]) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  gridColor: string;
  onGridColorChange: (color: string) => void;
};

export function ChartColorControls({
  categories,
  colors,
  palette,
  onColorsChange,
  onPaletteChange,
  backgroundColor,
  onBackgroundColorChange,
  gridColor,
  onGridColorChange,
}: ChartColorControlsProps) {
  const t = useTranslations("editor.chart");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [customPaletteDraft, setCustomPaletteDraft] = useState(palette.join(", "));

  function applyNamedPalette(id: ColorPaletteId) {
    const found = COLOR_PALETTES.find((p) => p.id === id);
    if (found) onPaletteChange(found.colors);
  }

  function applyCustomPalette() {
    const hexes = customPaletteDraft
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^#[0-9a-fA-F]{6}$/.test(s));
    if (hexes.length > 0) onPaletteChange(hexes);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <SingleColorSwatch
          defaultValue={DEFAULT_CHART_BACKGROUND}
          label={t("backgroundColor")}
          onChange={onBackgroundColorChange}
          resetLabel={t("resetColor")}
          value={backgroundColor}
        />
        <SingleColorSwatch
          defaultValue={DEFAULT_GRID_COLOR}
          label={t("gridColor")}
          onChange={onGridColorChange}
          resetLabel={t("resetColor")}
          value={gridColor}
        />

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("colorPalette")}</span>
          <Select onValueChange={(v) => (v === "none" ? onPaletteChange([]) : applyNamedPalette(v as ColorPaletteId))}>
            <SelectTrigger className="h-8 w-full rounded-2xl">
              <SelectValue placeholder={t("colorPaletteNone")} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="none">{t("colorPaletteNone")}</SelectItem>
              {COLOR_PALETTES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {t(`colorPalettes.${p.id}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("customPalette")}</span>
          <input
            className="h-8 w-full rounded-2xl border bg-transparent px-3 text-xs outline-none focus:bg-accent"
            onChange={(e) => setCustomPaletteDraft(e.target.value)}
            onBlur={applyCustomPalette}
            placeholder="#111111, #222222, ..."
            value={customPaletteDraft}
          />
        </label>
      </div>
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((key, index) => (
            <Popover key={key} onOpenChange={(open) => setOpenRow(open ? key : null)} open={openRow === key}>
              <PopoverTrigger asChild>
                <button
                  className="flex h-8 items-center gap-1.5 rounded-2xl border px-2 text-xs"
                  type="button"
                >
                  <span
                    className="size-3.5 shrink-0 rounded-full border"
                    style={{ backgroundColor: previewColor(colors, palette, key, index) }}
                  />
                  <span className="max-w-24 truncate">{key}</span>
                  {colors[key] ? (
                    <span
                      aria-label={t("resetColor")}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = { ...colors };
                        delete next[key];
                        onColorsChange(next);
                      }}
                      role="button"
                    >
                      ×
                    </span>
                  ) : null}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 rounded-2xl">
                <ColorPicker
                  className="gap-3"
                  onChange={(rgba) => onColorsChange({ ...colors, [key]: rgbaToHex(rgba as number[]) })}
                  value={previewColor(colors, palette, key, index)}
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
          ))}
        </div>
      ) : null}
    </div>
  );
}
