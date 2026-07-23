"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnvilTemplate } from "@/types/template";
import type { AnvilDocument } from "@/types/document";
import { TemplatePreviewDialog } from "@/components/templates/template-preview-dialog";
import { cn } from "@/lib/utils";

export function TemplatePreviewButton({
  template,
  displayName,
  description,
  onUseTemplate,
  className,
  document,
}: {
  template: AnvilTemplate;
  displayName: string;
  description: string;
  onUseTemplate?: (templateId: string) => void;
  className?: string;
  document?: AnvilDocument;
}) {
  const t = useTranslations("templates");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("previewTemplate")}
        className={cn("text-muted-foreground hover:text-foreground", className)}
        onClick={(event) => {
          // Cards may be clickable; don't trigger their select handler.
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Eye className="size-4" />
      </Button>

      <TemplatePreviewDialog
        template={template}
        displayName={displayName}
        description={description}
        open={open}
        onOpenChange={setOpen}
        onUseTemplate={onUseTemplate}
        document={document}
      />
    </>
  );
}
