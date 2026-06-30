"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileDown,
  FileText,
  LayoutTemplate,
  Languages,
  Plus,
  Settings,
  Sigma,
  SquareSigma,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { useUiStore } from "@/lib/stores/ui-store";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { getApiBaseUrl } from "@/lib/api";
import { deliverPdf } from "@/lib/export-pdf";
import { locales } from "@/lib/i18n/routing";

export function CommandMenu() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);

  const createDocument = useDocumentStore((s) => s.createDocument);
  const renderDocument = useDocumentStore((s) => s.renderDocument);
  const documents = useDocumentStore((s) => s.documents);
  const setActiveDocument = useDocumentStore((s) => s.setActive);
  const settings = useSettingsStore();
  const requestMath = useEditorBridge((s) => s.requestMath);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUiStore.getState().toggleCommand();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  async function exportCurrent() {
    const id =
      typeof params.documentId === "string" ? params.documentId : undefined;
    const doc = documents.find((d) => d.id === id) ?? documents[0];
    if (!doc) {
      toast.error(t("toast.noDocument"));
      return;
    }
    try {
      const result = await renderDocument(doc.id, {
        pageSize: settings.exportPageSize,
        fontPreset: settings.exportFontPreset,
        includeMetadata: settings.exportIncludeMetadata,
      });
      if (result.pdfUrl) {
        const delivered = await deliverPdf(
          `${getApiBaseUrl()}${result.pdfUrl}`,
          doc.title,
        );
        toast.success(
          delivered.kind === "folder"
            ? t("toast.exportSavedTo", { path: delivered.path })
            : t("toast.exportDownloaded", { name: delivered.fileName }),
        );
      } else {
        toast.success(t("toast.exportReady"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${t("toast.renderFailed")}: ${error.message}`
          : t("toast.renderFailed"),
      );
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("app.name")}
      description={t("command.placeholder")}
    >
      <Command>
        <CommandInput placeholder={t("command.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("command.empty")}</CommandEmpty>

          {documents.length > 0 ? (
            <>
              <CommandGroup heading={t("nav.documents")}>
                {documents.map((doc) => {
                  const title = doc.title || t("documents.untitled");
                  return (
                    <CommandItem
                      key={doc.id}
                      // cmdk fuzzy-matches the typed query against this value.
                      value={`${title} ${doc.id}`}
                      onSelect={() =>
                        run(() => {
                          setActiveDocument(doc.id);
                          router.push(`/documents/${doc.id}`);
                        })
                      }
                    >
                      <FileText className="size-4" />
                      <span className="truncate">{title}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          ) : null}

          <CommandGroup heading={t("command.groups.actions")}>
            <CommandItem
              onSelect={() =>
                run(() => {
                  void createDocument(undefined, t("documents.defaultTitle")).then((doc) => {
                    router.push(`/documents/${doc.id}`);
                    toast.success(t("toast.documentCreated"));
                  });
                })
              }
            >
              <Plus className="size-4" />
              {t("command.newDocument")}
            </CommandItem>
            <CommandItem onSelect={() => run(() => void exportCurrent())}>
              <FileDown className="size-4" />
              {t("command.export")}
            </CommandItem>
          </CommandGroup>

          {requestMath ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("command.groups.editor")}>
                <CommandItem
                  onSelect={() => run(() => requestMath("inline"))}
                >
                  <Sigma className="size-4" />
                  {t("command.insertInlineMath")}
                </CommandItem>
                <CommandItem onSelect={() => run(() => requestMath("block"))}>
                  <SquareSigma className="size-4" />
                  {t("command.insertBlockMath")}
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}

          <CommandSeparator />

          <CommandGroup heading={t("command.groups.navigation")}>
            <CommandItem onSelect={() => run(() => router.push("/documents"))}>
              <FileText className="size-4" />
              {t("command.goDocuments")}
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/templates"))}>
              <LayoutTemplate className="size-4" />
              {t("command.goTemplates")}
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/settings"))}>
              <Settings className="size-4" />
              {t("command.goSettings")}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t("command.groups.language")}>
            {locales
              .filter((l) => l !== locale)
              .map((l) => (
                <CommandItem
                  key={l}
                  onSelect={() =>
                    run(() => router.replace(pathname, { locale: l }))
                  }
                >
                  <Languages className="size-4" />
                  {t("command.switchLocale", {
                    locale: t(`locale.${l}` as never),
                  })}
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
