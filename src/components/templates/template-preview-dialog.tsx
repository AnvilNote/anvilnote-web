"use client";

import { useTranslations, useLocale } from "next-intl";
import { ArrowRight } from "lucide-react";
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
import type { AppLocale } from "@/lib/i18n/routing";
import { getTemplatePreview } from "@/lib/templates/preview";
import { TemplatePdfViewer } from "@/components/templates/template-pdf-viewer";

export function TemplatePreviewDialog({
  template,
  displayName,
  description,
  open,
  onOpenChange,
  onUseTemplate,
}: {
  template: AnvilTemplate;
  displayName: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate?: (templateId: string) => void;
}) {
  const t = useTranslations("templates");
  const locale = useLocale() as AppLocale;
  const preview = getTemplatePreview(template, locale);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[min(1100px,96vw)] flex-col gap-4 sm:max-w-[min(1100px,96vw)]"
        showCloseButton
      >
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle>
            {displayName} · {t("templatePreview")}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <TemplatePdfViewer
          pdfUrl={preview.pdfUrl}
          templateId={template.id}
          templateName={displayName}
        />

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
