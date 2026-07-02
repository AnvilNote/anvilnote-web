"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

export function MetadataForm({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === documentId),
  );
  const setMetadataField = useDocumentStore((s) => s.setMetadataField);
  const setTemplateSettingField = useDocumentStore(
    (s) => s.setTemplateSettingField,
  );
  const template = useTemplatesStore((s) =>
    doc ? s.getTemplate(doc.templateId) : undefined,
  );

  if (!doc) return null;

  if (!template || template.fields.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-muted-foreground">
        {t("panel.metadataEmpty")}
      </p>
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
              <Input
                id={`meta-${field.key}`}
                type="date"
                value={stringValue}
                onChange={(e) => writeValue(field, e.target.value)}
              />
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
    </div>
  );
}
