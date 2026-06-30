"use client";

import { useTranslations } from "next-intl";
import { FileText, Hash } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MetadataForm } from "@/components/templates/metadata-form";
import { TemplateSelector } from "@/components/templates/template-selector";
import { ExportPanel } from "@/components/export/export-panel";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useUiStore } from "@/lib/stores/ui-store";
import { extractOutline, type OutlineItem } from "@/lib/tiptap/serialization";
import { cn } from "@/lib/utils";

function useOutline(documentId: string): OutlineItem[] {
  const content = useDocumentStore(
    (s) => s.documents.find((d) => d.id === documentId)?.content,
  );
  return extractOutline(content);
}

function OutlinePanel({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const title = useDocumentStore(
    (s) => s.documents.find((d) => d.id === documentId)?.title ?? "",
  );
  const outline = useOutline(documentId);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{title || t("editor.titlePlaceholder")}</span>
      </div>
      {outline.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">
          {t("panel.outlineEmpty")}
        </p>
      ) : (
        outline.map((item, i) => (
          <div
            key={`${i}-${item.text}`}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            style={{ paddingInlineStart: `${0.5 + (item.level - 1) * 0.85}rem` }}
          >
            <Hash className="size-3.5 shrink-0 opacity-50" />
            <span className="truncate">{item.text}</span>
          </div>
        ))
      )}
    </div>
  );
}

function RightPanelContent({ documentId }: { documentId: string }) {
  const t = useTranslations("panel");

  return (
    <Tabs defaultValue="outline" className="flex h-full min-h-0 flex-col gap-0">
      <div className="px-3 pt-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="outline">{t("outline")}</TabsTrigger>
          <TabsTrigger value="metadata">{t("metadata")}</TabsTrigger>
          <TabsTrigger value="template">{t("template")}</TabsTrigger>
          <TabsTrigger value="export">{t("export")}</TabsTrigger>
        </TabsList>
      </div>
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-3">
          <TabsContent value="outline" className="mt-0">
            <OutlinePanel documentId={documentId} />
          </TabsContent>
          <TabsContent value="metadata" className="mt-0">
            <MetadataForm documentId={documentId} />
          </TabsContent>
          <TabsContent value="template" className="mt-0">
            <TemplateSelector documentId={documentId} />
          </TabsContent>
          <TabsContent value="export" className="mt-0">
            <ExportPanel documentId={documentId} />
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  );
}

export function RightPanel({
  documentId,
  className,
}: {
  documentId: string;
  className?: string;
}) {
  const t = useTranslations();
  const open = useUiStore((s) => s.mobilePanelOpen);
  const setOpen = useUiStore((s) => s.setMobilePanelOpen);

  return (
    <>
      <aside
        className={cn(
          "hidden w-80 shrink-0 border-l bg-sidebar lg:flex lg:flex-col",
          className,
        )}
      >
        <RightPanelContent documentId={documentId} />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[22rem] gap-0 p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("topbar.togglePanel")}</SheetTitle>
            <SheetDescription>{t("panel.metadataHint")}</SheetDescription>
          </SheetHeader>
          <div className="h-full pt-2">
            <RightPanelContent documentId={documentId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
