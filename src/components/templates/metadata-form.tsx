"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
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
import { useDocumentStore } from "@/lib/stores/document-store";
import { getTemplate } from "@/lib/templates/templates";

export function MetadataForm({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === documentId),
  );
  const setMetadataField = useDocumentStore((s) => s.setMetadataField);

  if (!doc) return null;
  const template = getTemplate(doc.templateId);

  if (template.fields.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-muted-foreground">
        {t("panel.metadataEmpty")}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{t("panel.metadataHint")}</p>

      {template.fields.map((field) => {
        const value = doc.metadata[field.key];
        const label = tt(field.label as never);
        const placeholder = field.placeholder
          ? tt(field.placeholder as never)
          : undefined;

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
                value={typeof value === "string" ? value : ""}
                placeholder={placeholder}
                onChange={(e) => setMetadataField(doc.id, field.key, e.target.value)}
              />
            )}

            {field.type === "date" && (
              <Input
                id={`meta-${field.key}`}
                type="date"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setMetadataField(doc.id, field.key, e.target.value)}
              />
            )}

            {field.type === "select" && (
              <Select
                value={typeof value === "string" && value ? value : undefined}
                onValueChange={(v) => setMetadataField(doc.id, field.key, v)}
              >
                <SelectTrigger id={`meta-${field.key}`} className="w-full">
                  <SelectValue placeholder={t("common.none")} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {tt(`options.${opt}` as never)}
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
                  checked={value === true}
                  onCheckedChange={(checked) =>
                    setMetadataField(doc.id, field.key, checked)
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
