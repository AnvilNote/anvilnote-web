"use client";

import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";

// Placeholder for the future Typst layout preview. The real pipeline will be:
//
//   Tiptap JSON
//     -> AnvilNote AST
//     -> LaTeX math converted to Typst math by the renderer
//     -> generated Typst project
//     -> Typst compiles to SVG pages
//     -> frontend preview panel
//
// None of that is wired here yet — this tab only shows a mock page frame.
export function PreviewPanel({ documentId }: { documentId: string }) {
  void documentId;
  const t = useTranslations("preview");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("notConnected")}</p>

      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="mx-auto flex aspect-[1/1.414] w-full max-w-[200px] flex-col items-center justify-center gap-2 rounded-sm border border-dashed bg-background text-muted-foreground">
          <FileText className="size-6 opacity-40" />
          <span className="text-xs">{t("mockPage")}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t("pipelineTitle")}
        </p>
        <ol className="space-y-1 text-xs text-muted-foreground">
          <li>1. {t("pipeline.tiptap")}</li>
          <li>2. {t("pipeline.ast")}</li>
          <li>3. {t("pipeline.typstMath")}</li>
          <li>4. {t("pipeline.typstProject")}</li>
          <li>5. {t("pipeline.svg")}</li>
        </ol>
      </div>
    </div>
  );
}
