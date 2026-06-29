"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportPayloadPreview } from "@/components/export/export-payload-preview";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { getApiBaseUrl } from "@/lib/api";
import { buildExportPayload } from "@/lib/export";
import type {
  ExportFontPreset,
  ExportPageSize,
  ExportPayload,
} from "@/types/export";

const PAGE_SIZES: ExportPageSize[] = ["A4", "Letter"];
const FONT_PRESETS: ExportFontPreset[] = ["sans", "serif", "mono"];

export function ExportPanel({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const te = useTranslations("export");
  const tt = useTranslations("templates");

  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === documentId),
  );
  const settings = useSettingsStore();
  const renderDocument = useDocumentStore((s) => s.renderDocument);
  const template = useTemplatesStore((s) =>
    doc ? s.getTemplate(doc.templateId) : undefined,
  );

  const [pageSize, setPageSize] = useState<ExportPageSize>(settings.exportPageSize);
  const [fontPreset, setFontPreset] = useState<ExportFontPreset>(
    settings.exportFontPreset,
  );
  const [includeMetadata, setIncludeMetadata] = useState(
    settings.exportIncludeMetadata,
  );
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ExportPayload | null>(null);

  if (!doc) return null;

  const templateName = template
    ? tt.has(template.name as never)
      ? tt(template.name as never)
      : template.name
    : doc.templateId;

  async function handleExport() {
    if (!doc) return;
    setLoading(true);
    // Reveal the renderer payload (Tiptap JSON + LaTeX math) and render to PDF.
    setPayload(
      buildExportPayload(doc, { pageSize, fontPreset, includeMetadata }),
    );
    try {
      const result = await renderDocument(doc.id, {
        pageSize,
        fontPreset,
        includeMetadata,
      });
      if (result.pdfUrl) {
        window.open(
          `${getApiBaseUrl()}${result.pdfUrl}`,
          "_blank",
          "noopener,noreferrer",
        );
      }
      toast.success(t("toast.exportReady"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${t("toast.renderFailed")}: ${error.message}`
          : t("toast.renderFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{te("subtitle")}</p>

      <div className="space-y-1.5">
        <Label className="text-sm">{te("template")}</Label>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          {templateName}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">{te("pageSize")}</Label>
        <Select
          value={pageSize}
          onValueChange={(v) => setPageSize(v as ExportPageSize)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">{te("fontPreset")}</Label>
        <Select
          value={fontPreset}
          onValueChange={(v) => setFontPreset(v as ExportFontPreset)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {te(`fonts.${preset}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <Label htmlFor="include-metadata" className="text-sm font-normal">
          {te("includeMetadata")}
        </Label>
        <Switch
          id="include-metadata"
          checked={includeMetadata}
          onCheckedChange={setIncludeMetadata}
        />
      </div>

      <Button
        onClick={() => void handleExport()}
        disabled={loading}
        className="w-full gap-1.5"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {te("exporting")}
          </>
        ) : (
          <>
            <FileDown className="size-4" />
            {te("button")}
          </>
        )}
      </Button>

      {payload ? <ExportPayloadPreview payload={payload} /> : null}
    </div>
  );
}
