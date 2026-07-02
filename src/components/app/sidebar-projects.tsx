"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, FileText, MoreHorizontal, Plus } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { DocumentActions } from "@/components/app/document-actions";
import { IconPicker } from "@/components/app/icon-picker";
import { ProjectMenu } from "@/components/app/project-menu";
import { randomProjectIcon } from "@/lib/lucide-icon";
import { documentDragProps, useProjectDropTarget } from "@/lib/dnd/document-drag";
import { exportProjectBackup } from "@/lib/export/backup";
import type { AnvilDocument } from "@/types/document";
import type { AnvilProject } from "@/types/project";
import { cn } from "@/lib/utils";

const NAME_MAX = 15;
const SIDEBAR_PROJECTS_LIMIT = 5;
const SIDEBAR_UNFILED_LIMIT = 3;

function ShowMoreRow({ href, label }: { href: string; label: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="text-muted-foreground">
        <Link href={href}>
          <MoreHorizontal className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// Truncate to NAME_MAX characters with an ellipsis (no wrapping).
function truncateName(name: string): string {
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}…` : name;
}

export function SidebarProjects() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const documents = useDocumentStore((s) => s.documents);
  const createDocument = useDocumentStore((s) => s.createDocument);
  const setActive = useDocumentStore((s) => s.setActive);
  const setDocumentProject = useDocumentStore((s) => s.setDocumentProject);

  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [deleteTarget, setDeleteTarget] = useState<AnvilProject | null>(null);
  // Inline name editing.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  // All projects start collapsed; ids here are the ones the user has
  // explicitly expanded (empty by default = everything collapsed).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // "Unfiled" is a single, non-repeated drop target, so the hook can be
  // called directly here rather than needing a per-row component.
  const { isOver: unfiledIsOver, dropHandlers: unfiledDropHandlers } =
    useProjectDropTarget((documentId) => void moveDocumentToProject(documentId, null));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  // New project: created instantly (no dialog) with a default name + random
  // icon. Name and icon are then editable inline. Stays collapsed by default
  // like every other project.
  async function handleCreateProject() {
    await createProject(t("projects.defaultName"), randomProjectIcon());
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

  async function moveDocumentToProject(documentId: string, projectId: string | null) {
    try {
      await setDocumentProject(documentId, projectId);
      const name = projectId
        ? (projects.find((p) => p.id === projectId)?.name ?? "")
        : t("projects.unfiled");
      toast.success(t("toast.documentMovedTo", { name }));
    } catch {
      toast.error(t("toast.documentMoveFailed"));
    }
  }

  async function newDocIn(projectId: string | null) {
    const doc = await createDocument(
      undefined,
      t("documents.defaultTitle"),
      { heading: t("documents.defaultHeading"), body: t("documents.defaultBody") },
      projectId,
    );
    closeMobile();
    router.push(`/documents/${doc.id}`);
  }

  async function exportProject(docs: AnvilDocument[]) {
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

  function renderDocs(list: AnvilDocument[]) {
    if (list.length === 0) {
      return (
        <p className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {t("documents.empty")}
        </p>
      );
    }
    return list.map((doc) => {
      const href = `/documents/${doc.id}`;
      const active = pathname === href;
      const title = doc.title || t("documents.untitled");
      return (
        <SidebarMenuItem
          key={doc.id}
          className="group/doc"
          {...documentDragProps(doc.id)}
        >
          <SidebarMenuButton asChild isActive={active} tooltip={title} className="pr-7">
            <Link
              href={href}
              onClick={() => {
                setActive(doc.id);
                closeMobile();
              }}
            >
              <FileText className="size-4 shrink-0" />
              <span className="truncate">{title}</span>
            </Link>
          </SidebarMenuButton>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within/doc:opacity-100 group-hover/doc:opacity-100 group-data-[collapsible=icon]:hidden">
            <DocumentActions
              doc={doc}
              onDeleted={() => {
                if (active) router.push("/documents");
              }}
            />
          </div>
        </SidebarMenuItem>
      );
    });
  }

  const unfiled = documents.filter((doc) => doc.projectId == null);
  const visibleProjects = projects.slice(0, SIDEBAR_PROJECTS_LIMIT);
  const visibleUnfiled = unfiled.slice(0, SIDEBAR_UNFILED_LIMIT);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>{t("projects.title")}</SidebarGroupLabel>
        <SidebarGroupAction
          aria-label={t("projects.create")}
          title={t("projects.create")}
          onClick={() => void handleCreateProject()}
          className="top-3 right-2 size-7 rounded-lg"
        >
          <Plus className="size-4.5" />
        </SidebarGroupAction>

        <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
          {projects.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("projects.empty")}
            </p>
          ) : (
            <>
              {visibleProjects.map((project) => {
                const docs = documents.filter((doc) => doc.projectId === project.id);
                return (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    docs={docs}
                    isCollapsed={!expanded.has(project.id)}
                    isRenaming={renamingId === project.id}
                    nameDraft={nameDraft}
                    onToggle={() => toggle(project.id)}
                    onStartRename={() => startRename(project)}
                    onNameDraftChange={setNameDraft}
                    onCommitRename={commitRename}
                    onCancelRename={() => setRenamingId(null)}
                    onIconChange={(icon) => void updateProject(project.id, { icon })}
                    onNewDoc={() => void newDocIn(project.id)}
                    onDelete={() => setDeleteTarget(project)}
                    onExport={() => void exportProject(docs)}
                    onDropDocument={(documentId) => void moveDocumentToProject(documentId, project.id)}
                    renderDocs={renderDocs}
                  />
                );
              })}
              {projects.length > SIDEBAR_PROJECTS_LIMIT ? (
                <SidebarMenu className="gap-1">
                  <ShowMoreRow href="/projects" label={t("common.showMore")} />
                </SidebarMenu>
              ) : null}
            </>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup
        {...unfiledDropHandlers}
        className={cn(
          "-mt-2 rounded-md pt-0 transition-colors",
          unfiledIsOver && "bg-sidebar-accent ring-2 ring-ring/50",
        )}
      >
        <SidebarGroupLabel>{t("projects.unfiled")}</SidebarGroupLabel>
        <SidebarGroupAction
          data-tour="new-doc"
          aria-label={t("nav.newDocument")}
          title={t("nav.newDocument")}
          onClick={() => void newDocIn(null)}
          className="top-3 right-2 size-7 rounded-lg"
        >
          <Plus className="size-4.5" />
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {renderDocs(visibleUnfiled)}
            {unfiled.length > SIDEBAR_UNFILED_LIMIT ? (
              <ShowMoreRow href="/documents" label={t("common.showMore")} />
            ) : null}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

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
    </>
  );
}

// Split out from SidebarProjects' render so useProjectDropTarget (a hook) can
// be called once per row instead of inside a .map() callback.
function ProjectRow({
  project,
  docs,
  isCollapsed,
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
  renderDocs,
}: {
  project: AnvilProject;
  docs: AnvilDocument[];
  isCollapsed: boolean;
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
  renderDocs: (list: AnvilDocument[]) => React.ReactNode;
}) {
  const t = useTranslations();
  const { isOver, dropHandlers } = useProjectDropTarget(onDropDocument);

  return (
    <div className="mb-0.5">
      {/* Header row: chevron (collapse) + icon (picker) + name
          (click to rename) + new-doc + actions menu. */}
      <div
        {...dropHandlers}
        className={cn(
          "group/proj flex items-center gap-0.5 rounded-md pr-1 hover:bg-sidebar-accent/50",
          isOver && "bg-sidebar-accent ring-2 ring-ring/50",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          aria-label={project.name}
          className="flex size-6 shrink-0 items-center justify-center rounded-md"
        >
          <ChevronRight
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              !isCollapsed && "rotate-90",
            )}
          />
        </button>
        <IconPicker
          value={project.icon}
          onChange={onIconChange}
          triggerClassName="size-6 rounded-md border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
          iconClassName="size-4"
        />
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
            className="h-6 min-w-0 flex-1 rounded border-0 bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        ) : (
          <button
            type="button"
            onClick={onStartRename}
            title={project.name}
            className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-sm font-medium hover:bg-accent/40"
          >
            {truncateName(project.name)}
          </button>
        )}
        <button
          type="button"
          aria-label={t("nav.newDocument")}
          title={t("nav.newDocument")}
          onClick={onNewDoc}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover/proj:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
        >
          <Plus className="size-4" />
        </button>
        <ProjectMenu
          onDelete={onDelete}
          onExport={onExport}
          exportDisabled={docs.length === 0}
          triggerClassName="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover/proj:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
        />
      </div>

      {!isCollapsed ? (
        <SidebarMenu className="gap-1 pl-3">{renderDocs(docs)}</SidebarMenu>
      ) : null}
    </div>
  );
}
