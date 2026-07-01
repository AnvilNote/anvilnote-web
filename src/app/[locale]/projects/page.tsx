"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, FileText, FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { DocumentActions } from "@/components/app/document-actions";
import { IconPicker } from "@/components/app/icon-picker";
import { ProjectMenu } from "@/components/app/project-menu";
import { exportProjectBackup } from "@/lib/export/backup";
import { randomProjectIcon } from "@/lib/lucide-icon";
import { documentDragProps, useProjectDropTarget } from "@/lib/dnd/document-drag";
import type { AnvilDocument } from "@/types/document";
import type { AnvilProject } from "@/types/project";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const t = useTranslations();
  const router = useRouter();

  const documents = useDocumentStore((s) => s.documents);
  const hydratedDocs = useDocumentStore((s) => s.hydrated);
  const createDocument = useDocumentStore((s) => s.createDocument);
  const setDocumentProject = useDocumentStore((s) => s.setDocumentProject);

  const projects = useProjectStore((s) => s.projects);
  const hydratedProjects = useProjectStore((s) => s.hydrated);
  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AnvilProject | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startRename(project: AnvilProject) {
    setRenamingId(project.id);
    setNameDraft(project.name);
  }

  function commitRename() {
    if (!renamingId) return;
    const trimmed = nameDraft.trim();
    const current = projects.find((p) => p.id === renamingId);
    if (trimmed && current && trimmed !== current.name) {
      void updateProject(renamingId, { name: trimmed });
    }
    setRenamingId(null);
  }

  async function handleNewProject() {
    await createProject(t("projects.defaultName"), randomProjectIcon());
  }

  async function moveDocumentToProject(documentId: string, projectId: string) {
    try {
      await setDocumentProject(documentId, projectId);
      const name = projects.find((p) => p.id === projectId)?.name ?? "";
      toast.success(t("toast.documentMovedTo", { name }));
    } catch {
      toast.error(t("toast.documentMoveFailed"));
    }
  }

  async function handleNewDocIn(projectId: string) {
    const doc = await createDocument(
      undefined,
      t("documents.defaultTitle"),
      { heading: t("documents.defaultHeading"), body: t("documents.defaultBody") },
      projectId,
    );
    router.push(`/documents/${doc.id}`);
  }

  async function handleExportProject(docs: AnvilDocument[]) {
    try {
      const result = await exportProjectBackup(docs);
      toast.success(
        result.kind === "folder"
          ? t("toast.exportSavedTo", { path: result.path })
          : t("toast.exportDownloaded", { name: result.fileName }),
      );
    } catch {
      toast.error(t("toast.exportFailed"));
    }
  }

  if (!hydratedDocs || !hydratedProjects) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("projects.pageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("projects.pageSubtitle")}
          </p>
        </div>
        <Button onClick={() => void handleNewProject()} className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t("projects.create")}</span>
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        {t("projects.count", { count: projects.length })}
      </p>

      {projects.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <p className="text-sm font-medium">{t("projects.empty")}</p>
          <p className="text-sm text-muted-foreground">
            {t("projects.emptyHint")}
          </p>
          <Button onClick={() => void handleNewProject()} variant="outline" className="gap-1.5">
            <FolderPlus className="size-4" />
            {t("projects.create")}
          </Button>
        </div>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border">
          {projects.map((project) => {
            const docs = documents.filter((doc) => doc.projectId === project.id);
            return (
              <ProjectListItem
                key={project.id}
                project={project}
                docs={docs}
                isExpanded={expanded.has(project.id)}
                isRenaming={renamingId === project.id}
                nameDraft={nameDraft}
                onToggle={() => toggle(project.id)}
                onStartRename={() => startRename(project)}
                onNameDraftChange={setNameDraft}
                onCommitRename={commitRename}
                onCancelRename={() => setRenamingId(null)}
                onIconChange={(icon) => void updateProject(project.id, { icon })}
                onNewDoc={() => void handleNewDocIn(project.id)}
                onDelete={() => setDeleteTarget(project)}
                onExport={() => void handleExportProject(docs)}
                onDropDocument={(documentId) => void moveDocumentToProject(documentId, project.id)}
              />
            );
          })}
        </ul>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("projects.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("projects.deleteDescription", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  const name = deleteTarget.name;
                  void deleteProject(deleteTarget.id).then(() =>
                    toast.success(t("toast.projectDeleted", { name })),
                  );
                }
                setDeleteTarget(null);
              }}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Split out from ProjectsPage's render so useProjectDropTarget (a hook) can be
// called once per row instead of inside a .map() callback.
function ProjectListItem({
  project,
  docs,
  isExpanded,
  isRenaming,
  nameDraft,
  onToggle,
  onStartRename,
  onNameDraftChange,
  onCommitRename,
  onCancelRename,
  onIconChange,
  onNewDoc,
  onDelete,
  onExport,
  onDropDocument,
}: {
  project: AnvilProject;
  docs: AnvilDocument[];
  isExpanded: boolean;
  isRenaming: boolean;
  nameDraft: string;
  onToggle: () => void;
  onStartRename: () => void;
  onNameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onIconChange: (icon: string | null) => void;
  onNewDoc: () => void;
  onDelete: () => void;
  onExport: () => void;
  onDropDocument: (documentId: string) => void;
}) {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const format = useFormatter();
  const getTemplate = useTemplatesStore((s) => s.getTemplate);
  const { isOver, dropHandlers } = useProjectDropTarget(onDropDocument);

  return (
    <li>
      <div
        {...dropHandlers}
        className={cn(
          "group flex items-center gap-2 px-4 py-3 transition-colors hover:bg-accent/40",
          isOver && "bg-accent/60 ring-2 ring-ring/50",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={project.name}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight
            className={cn("size-4 transition-transform", isExpanded && "rotate-90")}
          />
        </button>

        <IconPicker
          value={project.icon}
          onChange={onIconChange}
          triggerClassName="size-7 shrink-0 rounded-md border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
          iconClassName="size-4"
        />

        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <Input
              value={nameDraft}
              autoFocus
              onChange={(e) => onNameDraftChange(e.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitRename();
                } else if (e.key === "Escape") {
                  onCancelRename();
                }
              }}
              className="h-7 min-w-0 max-w-xs rounded border-0 bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          ) : (
            <button
              type="button"
              onClick={onStartRename}
              className="truncate rounded text-left text-sm font-medium hover:underline"
            >
              {project.name}
            </button>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {t("documents.count", { count: docs.length })} ·{" "}
            {t("documents.lastEdited", {
              date: format.dateTime(new Date(project.updatedAt), {
                dateStyle: "medium",
                timeStyle: "medium",
              }),
            })}
          </p>
        </div>

        <button
          type="button"
          aria-label={t("nav.newDocument")}
          title={t("nav.newDocument")}
          onClick={onNewDoc}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
        >
          <Plus className="size-4" />
        </button>

        <ProjectMenu
          onDelete={onDelete}
          onExport={onExport}
          exportDisabled={docs.length === 0}
        />
      </div>

      {isExpanded ? (
        <div className="border-t bg-muted/30 pl-12">
          {docs.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              {t("documents.empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {docs.map((doc) => {
                const template = getTemplate(doc.templateId);
                const templateName = template
                  ? tt.has(template.name as never)
                    ? tt(template.name as never)
                    : template.name
                  : doc.templateId;
                return (
                  <li
                    key={doc.id}
                    {...documentDragProps(doc.id)}
                    className="group/doc flex items-center gap-3 py-2.5 pr-4"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {doc.title || t("documents.untitled")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {templateName} ·{" "}
                        {t("documents.lastEdited", {
                          date: format.dateTime(new Date(doc.updatedAt), {
                            dateStyle: "medium",
                            timeStyle: "medium",
                          }),
                        })}
                      </p>
                    </Link>
                    <div className="opacity-0 transition-opacity group-hover/doc:opacity-100 group-focus-within/doc:opacity-100">
                      <DocumentActions doc={doc} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}
