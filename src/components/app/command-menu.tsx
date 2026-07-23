"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useSettingsDialogStore, useUiStore } from "@/lib/stores/ui-store";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { getApiBaseUrl } from "@/lib/api";
import { deliverPdf } from "@/lib/export-pdf";
import { resolveExportFolder } from "@/lib/export-folder";
import { getNodeText } from "@/lib/tiptap/serialization";
import { locales } from "@/lib/i18n/routing";

// Cap how much body text feeds the fuzzy index (perf) and snippet context size.
const BODY_INDEX_LIMIT = 4000;
const SNIPPET_PAD = 32;

// Splits `text` on every case-insensitive occurrence of `query` and wraps the
// matches in <strong>. Returns the raw string when there's nothing to mark.
function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let from = lower.indexOf(ql);
  if (from < 0) return text;
  let key = 0;
  while (from >= 0) {
    if (from > i) parts.push(text.slice(i, from));
    parts.push(
      <strong key={key++} className="font-semibold text-foreground">
        {text.slice(from, from + q.length)}
      </strong>,
    );
    i = from + q.length;
    from = lower.indexOf(ql, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

// A short context window around the first substring match, or null if the query
// only matched the title (so no body snippet is shown).
function bodySnippet(text: string, query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return null;
  const start = Math.max(0, i - SNIPPET_PAD);
  const end = Math.min(text.length, i + q.length + SNIPPET_PAD);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, end).replace(/\s+/g, " ").trim() +
    (end < text.length ? "…" : "")
  );
}

export function CommandMenu() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const openSettings = useSettingsDialogStore((s) => s.openSettings);

  const createDocument = useDocumentStore((s) => s.createDocument);
  const renderDocument = useDocumentStore((s) => s.renderDocument);
  const documents = useDocumentStore((s) => s.documents);
  const setActiveDocument = useDocumentStore((s) => s.setActive);
  const projects = useProjectStore((s) => s.projects);
  const settings = useSettingsStore();

  // Track the query so we can show a body snippet for content matches.
  const [query, setQuery] = useState("");

  // Pre-extract each document's plain body text once for fuzzy search.
  const docIndex = useMemo(
    () =>
      documents.map((doc) => ({
        doc,
        title: doc.title || t("documents.untitled"),
        body: getNodeText(doc.content).slice(0, BODY_INDEX_LIMIT),
      })),
    [documents, t],
  );

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
        includeMetadata: true,
      });
      if (result.pdfUrl) {
        const delivered = await deliverPdf(
          `${getApiBaseUrl()}${result.pdfUrl}`,
          doc.title,
          resolveExportFolder(doc, projects, t("projects.unfiled")),
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
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      title={t("app.name")}
      description={t("command.placeholder")}
    >
      <Command>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("command.placeholder")}
        />
        <CommandList>
          <CommandEmpty>{t("command.empty")}</CommandEmpty>

          {documents.length > 0 ? (
            <>
              <CommandGroup heading={t("nav.documents")}>
                {docIndex.map(({ doc, title, body }) => {
                  // cmdk fuzzy-matches the query against title + body text + id,
                  // so a document is found by its content, not just its name.
                  const snippet = bodySnippet(body, query);
                  return (
                    <CommandItem
                      key={doc.id}
                      value={`${title} ${body} ${doc.id}`}
                      onSelect={() =>
                        run(() => {
                          setActiveDocument(doc.id);
                          router.push(`/documents/${doc.id}`);
                        })
                      }
                    >
                      <FileText className="size-4 shrink-0 self-start" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{highlight(title, query)}</span>
                        {snippet ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {highlight(snippet, query)}
                          </span>
                        ) : null}
                      </div>
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
                  void createDocument(undefined, t("documents.defaultTitle"), {
                    heading: t("documents.defaultHeading"),
                    body: t("documents.defaultBody"),
                  }).then((doc) => {
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
            <CommandItem onSelect={() => run(() => openSettings())}>
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
