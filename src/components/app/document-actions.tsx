"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, FileDown, FolderInput, Inbox, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Label } from "@/components/ui/label";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { exportDocumentMarkdown } from "@/lib/export/backup";
import { LucideIcon } from "@/lib/lucide-icon";
import type { AnvilDocument } from "@/types/document";
import { cn } from "@/lib/utils";

export function DocumentActions({
  doc,
  className,
  onDeleted,
}: {
  doc: AnvilDocument;
  className?: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations();
  const renameDocument = useDocumentStore((s) => s.renameDocument);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);
  const duplicateDocument = useDocumentStore((s) => s.duplicateDocument);
  const setDocumentProject = useDocumentStore((s) => s.setDocumentProject);
  const projects = useProjectStore((s) => s.projects);

  async function moveTo(projectId: string | null) {
    try {
      await setDocumentProject(doc.id, projectId);
      const name = projectId
        ? (projects.find((p) => p.id === projectId)?.name ?? "")
        : t("projects.unfiled");
      toast.success(t("toast.documentMovedTo", { name }));
    } catch {
      toast.error(t("toast.documentMoveFailed"));
    }
  }

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(doc.title);

  const title = doc.title || t("documents.untitled");

  function commitRename() {
    renameDocument(doc.id, draftTitle.trim());
    setRenameOpen(false);
    toast.success(t("toast.documentRenamed"));
  }

  async function duplicate() {
    await duplicateDocument(doc.id);
    toast.success(t("toast.documentCreated"));
  }

  async function exportMarkdown() {
    try {
      const result = await exportDocumentMarkdown(doc);
      toast.success(
        result.kind === "folder"
          ? t("toast.exportSavedTo", { path: result.path })
          : t("toast.exportDownloaded", { name: result.fileName }),
      );
    } catch {
      toast.error(t("toast.exportFailed"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-7 text-muted-foreground", className)}
            aria-label={t("common.open")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() => {
              setDraftTitle(doc.title);
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-4" />
            {t("common.rename")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void duplicate()}>
            <Copy className="size-4" />
            {t("common.duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportMarkdown()}>
            <FileDown className="size-4" />
            {t("documents.exportMarkdown")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="size-4" />
              {t("projects.moveTo")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              <DropdownMenuItem
                disabled={doc.projectId === null}
                onSelect={() => void moveTo(null)}
              >
                <Inbox className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{t("projects.unfiled")}</span>
                {doc.projectId === null ? (
                  <Check className="ml-auto size-4 shrink-0" />
                ) : null}
              </DropdownMenuItem>
              {projects.length > 0 ? <DropdownMenuSeparator /> : null}
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  disabled={doc.projectId === project.id}
                  onSelect={() => void moveTo(project.id)}
                >
                  <LucideIcon
                    iconName={project.icon}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{project.name}</span>
                  {doc.projectId === project.id ? (
                    <Check className="ml-auto size-4 shrink-0" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="font-medium"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("common.rename")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">{t("documents.title")}</Label>
            <Input
              id="rename-input"
              value={draftTitle}
              autoFocus
              placeholder={t("editor.titlePlaceholder")}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={commitRename}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("documents.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("documents.deleteDescription", { title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90"
              onClick={() => {
                void deleteDocument(doc.id);
                setDeleteOpen(false);
                toast.success(t("toast.documentDeleted"));
                onDeleted?.();
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
