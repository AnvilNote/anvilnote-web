"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
