"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { parseMarkdownFile, readZipMarkdownFiles } from "@/lib/export/restore";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/templates";

// Shared import logic for the Markdown/zip backup importer, used by both the
// Documents page header button and the Settings > Backup section.
export function useImportBackup() {
  const t = useTranslations();
  const importDocument = useDocumentStore((s) => s.importDocument);
  const createProject = useProjectStore((s) => s.createProject);
  const getTemplate = useTemplatesStore((s) => s.getTemplate);

  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function resolveTemplateId(templateId: string | null): string {
    return templateId && getTemplate(templateId) ? templateId : DEFAULT_TEMPLATE_ID;
  }

  async function importOneMarkdown(raw: string, fallbackTitle: string, projectId: string | null) {
    const parsed = parseMarkdownFile(raw, fallbackTitle);
    await importDocument({
      title: parsed.title,
      content: parsed.content,
      metadata: parsed.metadata,
      templateSettings: {},
      templateId: resolveTemplateId(parsed.templateId),
      projectId,
    });
  }

  async function importFile(file: File) {
    setImporting(true);
    try {
      let count = 0;
      if (file.name.toLowerCase().endsWith(".zip")) {
        const entries = await readZipMarkdownFiles(file);
        // A folder matching our own "unfiled" export label maps back to no
        // project, instead of round-tripping into a real project named that.
        const unfiledLabel = t("projects.unfiled");
        const projectIdByFolder = new Map<string, string>();
        for (const entry of entries) {
          let projectId: string | null = null;
          if (entry.folder && entry.folder !== unfiledLabel) {
            if (!projectIdByFolder.has(entry.folder)) {
              const project = await createProject(entry.folder, null);
              projectIdByFolder.set(entry.folder, project.id);
            }
            projectId = projectIdByFolder.get(entry.folder) ?? null;
          }
          await importOneMarkdown(
            entry.raw,
            entry.filename.replace(/\.md$/i, ""),
            projectId,
          );
          count += 1;
        }
      } else {
        await importOneMarkdown(await file.text(), file.name.replace(/\.md$/i, ""), null);
        count = 1;
      }
      toast.success(t("toast.importSucceeded", { count }));
    } catch {
      toast.error(t("toast.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  function triggerImport() {
    inputRef.current?.click();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void importFile(file);
  }

  return { importing, inputRef, triggerImport, handleInputChange };
}
