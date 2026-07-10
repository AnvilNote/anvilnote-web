"use client";

import { useTranslations } from "next-intl";
import { CalendarIcon, ChevronDown, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DATE_FORMATS, formatIsoDate } from "@/lib/date-format";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import type { AnvilMetadataValue } from "@/types/document";
import type { TemplateField } from "@/types/template";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Stored/wire value is a plain "YYYY-MM-DD" string (unchanged — this is a
// display-layer swap, not a data model change). Parsed at noon UTC, not
// midnight: constructing from just the date parts is otherwise interpreted
// in the LOCAL timezone, and a browser west of UTC would then render the
// picker's day highlight as the day before the one that's actually stored.
function parseIsoDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const parsed = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// react-day-picker's onSelect hands back a Date at LOCAL midnight of the
// clicked day. toISOString() always converts to UTC first, which shifts
// the calendar day backward for any timezone ahead of UTC (e.g. clicking
// July 15 in Taipei, UTC+8, produced "2026-07-14" — local midnight July 15
// is 16:00 UTC July 14). Building the string from the Date's own local
// year/month/day fields instead avoids that conversion entirely.
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MetadataForm({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const dateFormat = useSettingsStore((s) => s.dateFormat);
  const setDateFormat = useSettingsStore((s) => s.setDateFormat);
  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === documentId),
  );
  const setMetadataField = useDocumentStore((s) => s.setMetadataField);
  const setTemplateSettingField = useDocumentStore(
    (s) => s.setTemplateSettingField,
  );
  const setNumberedHeadings = useDocumentStore((s) => s.setNumberedHeadings);
  const template = useTemplatesStore((s) =>
    doc ? s.getTemplate(doc.templateId) : undefined,
  );

  if (!doc) return null;

  // Document-level, template-independent — rendered unconditionally, even
  // when the active template has no manifest fields of its own.
  const numberedHeadingsToggle = (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <div>
        <Label htmlFor="numbered-headings" className="text-sm font-normal">
          {t("panel.numberedHeadings.label")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("panel.numberedHeadings.description")}
        </p>
      </div>
      <Switch
        id="numbered-headings"
        checked={doc.numberedHeadings}
        onCheckedChange={(checked) => setNumberedHeadings(doc.id, checked)}
      />
    </div>
  );

  if (!template || template.fields.length === 0) {
    return (
      <div className="space-y-5">
        <p className="px-1 py-2 text-sm text-muted-foreground">
          {t("panel.metadataEmpty")}
        </p>
        {numberedHeadingsToggle}
      </div>
    );
  }

  // Read/write the value from the bucket the field's scope points at.
  const readValue = (field: TemplateField): AnvilMetadataValue => {
    const bucket = field.scope === "option" ? doc.templateSettings : doc.metadata;
    return bucket[field.key];
  };
  const writeValue = (field: TemplateField, value: AnvilMetadataValue) => {
    if (field.scope === "option") {
      setTemplateSettingField(doc.id, field.key, value);
    } else {
      setMetadataField(doc.id, field.key, value);
    }
  };

  // Localized label, falling back to the raw label if no message exists.
  const labelFor = (field: TemplateField) =>
    tt.has(field.label as never) ? tt(field.label as never) : field.label;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{t("panel.metadataHint")}</p>

      {template.fields.map((field) => {
        if (field.dependsOn) {
          const dependsField = template.fields.find(
            (f) => f.key === field.dependsOn?.key,
          );
          const dependsValue = dependsField ? readValue(dependsField) : undefined;
          if (dependsValue !== field.dependsOn.value) {
            return null;
          }
        }

        const raw = readValue(field);
        const label = labelFor(field);

        const stringValue =
          field.type === "date" && raw === "today"
            ? todayIso()
            : typeof raw === "string"
              ? raw
              : "";

        return (
          <div key={field.key} className="space-y-1.5">
            {field.type !== "boolean" ? (
              <div className="flex items-center gap-2">
                <Label htmlFor={`meta-${field.key}`} className="text-sm">
                  {label}
                </Label>
                {field.required ? (
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                    {t("common.required")}
                  </Badge>
                ) : null}
                {field.type === "color" ? (
                  <button
                    type="button"
                    title={t("editor.block.colors.default")}
                    aria-label={t("editor.block.colors.default")}
                    onClick={() =>
                      writeValue(
                        field,
                        typeof field.default === "string" ? field.default : null,
                      )
                    }
                    className="ml-auto flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}

            {field.type === "text" && (
              <Input
                id={`meta-${field.key}`}
                value={stringValue}
                placeholder={field.placeholder}
                onChange={(e) => writeValue(field, e.target.value)}
              />
            )}

            {field.type === "textarea" && (
              <Textarea
                id={`meta-${field.key}`}
                value={stringValue}
                placeholder={field.placeholder}
                onChange={(e) => writeValue(field, e.target.value)}
              />
            )}

            {field.type === "date" && (
              <div className="flex w-full items-stretch rounded-md border">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id={`meta-${field.key}`}
                      type="button"
                      variant="ghost"
                      className="flex-1 justify-start gap-2 rounded-r-none border-0 font-normal"
                    >
                      <CalendarIcon className="size-4 text-muted-foreground" />
                      {stringValue && parseIsoDate(stringValue) ? (
                        formatIsoDate(stringValue, dateFormat)
                      ) : (
                        <span className="text-muted-foreground">{field.placeholder}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseIsoDate(stringValue)}
                      onSelect={(date) => date && writeValue(field, toIsoDate(date))}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="w-px shrink-0 bg-border" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={t("panel.dateFormat")}
                      title={t("panel.dateFormat")}
                      className="rounded-l-none border-0 px-2"
                    >
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {DATE_FORMATS.map((option) => (
                      <DropdownMenuItem key={option} onSelect={() => setDateFormat(option)}>
                        {option}
                        {option === dateFormat ? (
                          <span className="ml-auto text-muted-foreground">✓</span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {field.type === "select" && (
              <Select
                value={typeof raw === "string" && raw ? raw : undefined}
                onValueChange={(v) => writeValue(field, v)}
              >
                <SelectTrigger id={`meta-${field.key}`} className="w-full">
                  <SelectValue placeholder={t("common.none")} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {tt.has(`options.${opt}` as never)
                        ? tt(`options.${opt}` as never)
                        : opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === "boolean" && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label htmlFor={`meta-${field.key}`} className="text-sm font-normal">
                  {label}
                </Label>
                <Switch
                  id={`meta-${field.key}`}
                  checked={raw === true}
                  onCheckedChange={(checked) => writeValue(field, checked)}
                />
              </div>
            )}

            {field.type === "color" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    id={`meta-${field.key}`}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border"
                      style={{ backgroundColor: stringValue || "#0000ff" }}
                    />
                    <span className="text-muted-foreground">{stringValue || "#0000ff"}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <ColorPicker
                    value={stringValue || "#0000ff"}
                    onChange={(rgba) => {
                      const [r, g, b] = rgba as [number, number, number, number];
                      const hex = `#${[r, g, b]
                        .map((c) => Math.round(c).toString(16).padStart(2, "0"))
                        .join("")}`;
                      writeValue(field, hex);
                    }}
                    className="gap-3"
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
            )}
          </div>
        );
      })}

      {numberedHeadingsToggle}
    </div>
  );
}
