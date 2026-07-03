"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { FileDown, FileText, Hash, History, Info, LayoutTemplate, List } from "lucide-react";
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
import { VersionHistoryPanel } from "@/components/app/version-history-panel";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useUiStore, useRightPanelTabStore } from "@/lib/stores/ui-store";
import { useTourStore } from "@/lib/stores/tour-store";
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

// Unselected tabs show only their icon; the active tab additionally shows
// its label. Five tabs' full labels don't fit this panel's ~320px width at
// once (Outline/History both ended up clipped mid-word), and unlike the
// main toolbar there's no natural "scroll instead of clipping" fallback
// that still keeps every tab identifiable when the row's already this
// narrow — collapsing to icon-only for the tabs you're not looking at is
// the same tradeoff macOS's own Finder sidebar makes for the same reason.
function PanelTab({
  value,
  active,
  icon: Icon,
  label,
}: {
  value: string;
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      aria-label={label}
      title={label}
      className="shrink-0 gap-1.5 rounded-[1.3rem] px-2.5 py-1.5 text-[0.95rem] leading-none whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      <Icon className="size-4 shrink-0" />
      {active ? label : null}
    </TabsTrigger>
  );
}

function RightPanelContent({ documentId }: { documentId: string }) {
  const t = useTranslations("panel");
  // Persisted (see ui-store.ts's useRightPanelTabStore) so which tab was
  // last open survives a reload or locale switch instead of always
  // resetting to Outline.
  const tab = useRightPanelTabStore((s) => s.tab);
  const setTab = useRightPanelTabStore((s) => s.setTab);
  const markTabVisited = useTourStore((s) => s.markTabVisited);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value);
        markTabVisited(value);
      }}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="px-3 pt-3">
        {/* flex + content-sized triggers, not a 4-equal-column grid — a fixed
            grid force-truncated longer labels even when the panel had room
            to spare elsewhere. overflow-x-auto is still the fallback for
            whatever doesn't fit even after collapsing inactive tabs to
            icon-only (see PanelTab). */}
        <TabsList
          data-tour="right-tabs"
          className="flex h-auto w-full items-center gap-0.5 overflow-x-auto rounded-[1.7rem] bg-muted p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <PanelTab value="outline" active={tab === "outline"} icon={List} label={t("outline")} />
          <PanelTab value="metadata" active={tab === "metadata"} icon={Info} label={t("metadata")} />
          <PanelTab
            value="template"
            active={tab === "template"}
            icon={LayoutTemplate}
            label={t("template")}
          />
          <PanelTab value="export" active={tab === "export"} icon={FileDown} label={t("export")} />
          <PanelTab
            value="history"
            active={tab === "history"}
            icon={History}
            label={t("history")}
          />
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
          <TabsContent value="history" className="mt-0">
            <VersionHistoryPanel documentId={documentId} active={tab === "history"} />
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
