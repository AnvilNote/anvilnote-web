"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AnvilTemplate } from "@/types/template";
import type { AnvilDocument } from "@/types/document";
import type { AppLocale } from "@/lib/i18n/routing";
import { getApiBaseUrl } from "@/lib/api";
import { getTemplatePreview } from "@/lib/templates/preview";
import { renderDocumentPreview } from "@/lib/templates/live-preview";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { TemplatePdfViewer } from "@/components/templates/template-pdf-viewer";

export function TemplatePreviewDialog({
  template,
  displayName,
  description,
  open,
  onOpenChange,
  onUseTemplate,
  document,
}: {
  template: AnvilTemplate;
  displayName: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate?: (templateId: string) => void;
  // When set (the picker is open from inside a real document, not the
  // standalone template gallery), the preview renders THIS document's real
  // content through the candidate template instead of showing the generic
  // per-template sample — answers "what would my document actually look
  // like in this template" rather than "what does this template look like".
  document?: AnvilDocument;
}) {
  const t = useTranslations("templates");
  const locale = useLocale() as AppLocale;
  const staticPreview = getTemplatePreview(template, locale);
  const exportPageSize = useSettingsStore((s) => s.exportPageSize);
  const exportFontPreset = useSettingsStore((s) => s.exportFontPreset);

  const [livePdfUrl, setLivePdfUrl] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!open || !document) return;
    let active = true;
    setLiveState("loading");
    setLivePdfUrl(null);
    renderDocumentPreview(document, template.id, {
      pageSize: exportPageSize,
      fontPreset: exportFontPreset,
      includeMetadata: true,
    })
      .then((pdfUrl) => {
        if (!active) return;
        if (pdfUrl) {
          setLivePdfUrl(`${getApiBaseUrl()}${pdfUrl}`);
          setLiveState("ready");
        } else {
          setLiveState("error");
        }
      })
      .catch(() => {
        if (active) setLiveState("error");
      });
    return () => {
      active = false;
    };
  }, [open, document, template.id, exportPageSize, exportFontPreset]);

  const pdfUrl = document ? livePdfUrl : staticPreview.pdfUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[min(1100px,96vw)] flex-col gap-4 sm:max-w-[min(1100px,96vw)]"
        showCloseButton
        // Radix's Portal keeps the dialog in the React tree (not the DOM
        // tree) for event bubbling purposes, so a click anywhere in here —
        // including the built-in close (X) button — would otherwise bubble
        // up through TemplatePreviewButton into TemplateCard's own onClick
        // and switch the document's template as a side effect of closing.
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle>
            {displayName} · {t("templatePreview")}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {document && liveState === "loading" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            {t("renderingPreview")}
          </div>
        ) : document && liveState === "error" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 px-6 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t("previewRenderFailed")}</p>
          </div>
        ) : (
          <TemplatePdfViewer
            pdfUrl={pdfUrl ?? staticPreview.pdfUrl}
            templateId={template.id}
            templateName={displayName}
          />
        )}

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            onClick={() => {
              onUseTemplate?.(template.id);
              onOpenChange(false);
            }}
            className="gap-1.5"
          >
            {t("useThisTemplate")}
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
