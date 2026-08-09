"use client";

import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
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
import type { FieldDescriptor } from "@/lib/chart/chart-registry";

function rgbaToHex(rgba: number[]): string {
  const [r, g, b] = rgba as [number, number, number, number];
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

export type ChartExtraFieldsProps = {
  fields: FieldDescriptor[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
};

// Walks CHART_DEFS[chartType].fields and renders each one's control — the
// single generic renderer every chart type's extra params go through,
// instead of a bespoke form per chart type (see chart-registry.ts's own
// comment on why this table is the source of truth).
export function ChartExtraFields({ fields, values, onChange }: ChartExtraFieldsProps) {
  const t = useTranslations("editor.chart");

  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {fields.map((field) => {
        const label = t.has(`fields.${field.labelKey}` as never)
          ? t(`fields.${field.labelKey}` as never)
          : field.labelKey;
        const value = values[field.key] ?? field.default;

        if (field.kind === "slider") {
          return (
            <label className="flex flex-col gap-1 text-xs" key={field.key}>
              <span className="text-muted-foreground">
                {label}: {value}
              </span>
              <input
                className="w-full accent-black"
                max={field.max}
                min={field.min}
                onChange={(e) => onChange(field.key, Number(e.target.value))}
                step={field.step}
                type="range"
                value={Number(value)}
              />
            </label>
          );
        }

        if (field.kind === "select") {
          return (
            <label className="flex flex-col gap-1 text-xs" key={field.key}>
              <span className="text-muted-foreground">{label}</span>
              <Select onValueChange={(v) => onChange(field.key, v)} value={String(value)}>
                <SelectTrigger className="h-8 w-full rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {field.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t.has(`fieldOptions.${opt}` as never) ? t(`fieldOptions.${opt}` as never) : opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          );
        }

        if (field.kind === "checkbox") {
          return (
            <label className="flex items-center gap-2 text-xs" key={field.key}>
              <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(field.key, v)} />
              {label}
            </label>
          );
        }

        if (field.kind === "color") {
          return (
            <div className="flex flex-col gap-1 text-xs" key={field.key}>
              <span className="text-muted-foreground">{label}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="flex h-8 w-full items-center gap-1.5 rounded-2xl border px-2"
                    type="button"
                  >
                    <span className="size-3.5 shrink-0 rounded-full border" style={{ backgroundColor: String(value) }} />
                    <span className="font-mono">{String(value)}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 rounded-2xl">
                  <ColorPicker
                    className="gap-3"
                    onChange={(rgba) => onChange(field.key, rgbaToHex(rgba as number[]))}
                    value={String(value)}
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
            </div>
          );
        }

        // text
        return (
          <label className="flex flex-col gap-1 text-xs" key={field.key}>
            <span className="text-muted-foreground">{label}</span>
            <input
              className="h-8 w-full rounded-2xl border bg-transparent px-3 outline-none focus:bg-accent"
              onChange={(e) => onChange(field.key, e.target.value)}
              value={String(value)}
            />
          </label>
        );
      })}
    </div>
  );
}
