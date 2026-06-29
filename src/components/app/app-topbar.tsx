"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { FileDown, Loader2, PanelRight, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { useUiStore } from "@/lib/stores/ui-store";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { getApiBaseUrl } from "@/lib/api";

export function AppTopbar() {
  const t = useTranslations();
  const params = useParams();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setMobilePanelOpen = useUiStore((s) => s.setMobilePanelOpen);

  const documents = useDocumentStore((s) => s.documents);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const renderDocument = useDocumentStore((s) => s.renderDocument);
  const saveStateById = useDocumentStore((s) => s.saveStateById);
  const renderingById = useDocumentStore((s) => s.renderingById);
  const settings = useSettingsStore();

  const documentId =
    typeof params.documentId === "string" ? params.documentId : undefined;
  const activeDoc = documents.find((d) => d.id === documentId);

  async function handleExport() {
    if (!activeDoc) {
      toast.error(t("toast.noDocument"));
      return;
    }
    try {
      const result = await renderDocument(activeDoc.id, {
        pageSize: settings.exportPageSize,
        fontPreset: settings.exportFontPreset,
        includeMetadata: settings.exportIncludeMetadata,
      });

      if (result.pdfUrl) {
        window.open(`${getApiBaseUrl()}${result.pdfUrl}`, "_blank", "noopener,noreferrer");
      }
      toast.success(t("toast.exportReady"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${t("toast.renderFailed")}: ${error.message}`
          : t("toast.renderFailed"),
      );
    }
  }

  async function handleSave() {
    if (!activeDoc) {
      toast.error(t("toast.noDocument"));
      return;
    }

    try {
      await saveDocument(activeDoc.id);
      toast.success(t("toast.documentSaved"));
    } catch {
      toast.error(t("toast.saveFailed"));
    }
  }

  const isSaving = documentId ? saveStateById[documentId] === "saving" : false;
  const isRendering = documentId ? renderingById[documentId] === true : false;

  return (
    <header className="sticky top-0 z-20 flex h-13 shrink-0 items-center gap-1 border-b bg-background/80 px-2 md:gap-1.5 md:px-3 backdrop-blur">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator orientation="vertical" className="mr-1 hidden h-5 md:block" />

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:max-w-md md:px-3"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">{t("topbar.search")}</span>
        <kbd className="pointer-events-none hidden rounded border bg-background px-1.5 font-mono text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 md:gap-1">
        <ThemeToggle />
        <LocaleSwitcher />
        {activeDoc ? (
          <Button
            onClick={() => void handleSave()}
            size="sm"
            variant="outline"
            className="gap-1 px-2 md:gap-1.5 md:px-2.5"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="hidden md:inline">{t("common.save")}</span>
          </Button>
        ) : null}
        {activeDoc ? (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t("topbar.togglePanel")}
            onClick={() => setMobilePanelOpen(true)}
          >
            <PanelRight className="size-4" />
          </Button>
        ) : null}
        <Button onClick={() => void handleExport()} size="sm" className="gap-1 px-2 md:gap-1.5 md:px-2.5" disabled={isRendering}>
          {isRendering ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          <span className="hidden md:inline">{t("topbar.export")}</span>
        </Button>
      </div>
    </header>
  );
}
