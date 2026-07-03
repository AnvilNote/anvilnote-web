"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { History, Loader2, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VersionPreview } from "@/components/app/version-preview";
import { getDocumentVersion } from "@/lib/api";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import type { AnvilDocumentVersion, AnvilDocumentVersionSummary } from "@/types/document";

// Right-panel tab: lists this document's version snapshots and lets the
// user preview/restore one. The list itself lives in the document store
// (versionsById), not local state — a snapshot created in the background
// (see document-store.ts's maybeSnapshotVersion) or a restore both update
// it there, so this panel reflects new entries immediately even if it's
// sitting open the whole time, instead of only refreshing when its tab
// becomes active again.
export function VersionHistoryPanel({
  documentId,
  active,
}: {
  documentId: string;
  active: boolean;
}) {
  const t = useTranslations("panel");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const versions = useDocumentStore((s) => s.versionsById[documentId]);
  const loadVersions = useDocumentStore((s) => s.loadVersions);
  const restoreVersion = useDocumentStore((s) => s.restoreVersion);
  const snapshotIntervalMinutes = useSettingsStore((s) => s.versionSnapshotIntervalMinutes);

  const [loadError, setLoadError] = useState(false);
  const [openVersion, setOpenVersion] = useState<AnvilDocumentVersion | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadVersions(documentId)
      .then(() => {
        if (!cancelled) setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, active, loadVersions]);

  async function openPreview(summary: AnvilDocumentVersionSummary) {
    setPreviewLoading(summary.id);
    try {
      const full = await getDocumentVersion(documentId, summary.id);
      setOpenVersion(full);
    } catch {
      toast.error(t("historyLoadError"));
    } finally {
      setPreviewLoading(null);
    }
  }

  async function handleRestore() {
    if (!openVersion) return;
    setRestoring(true);
    try {
      await restoreVersion(documentId, openVersion.id);
      toast.success(t("historyRestored"));
      setOpenVersion(null);
    } catch {
      toast.error(t("historyRestoreFailed"));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-1">
      {loadError ? (
        <p className="px-2 py-2 text-sm text-destructive">{t("historyLoadError")}</p>
      ) : versions === undefined ? (
        <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t("historyLoading")}
        </p>
      ) : versions.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">
          {snapshotIntervalMinutes === 0 ? t("historyEmptyOff") : t("historyEmpty")}
        </p>
      ) : (
        versions.map((version) => (
          <button
            key={version.id}
            type="button"
            onClick={() => void openPreview(version)}
            disabled={previewLoading === version.id}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
          >
            {previewLoading === version.id ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <History className="size-3.5 shrink-0 opacity-50" />
            )}
            <span className="truncate">
              {format.dateTime(new Date(version.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </button>
        ))
      )}

      <Dialog open={openVersion !== null} onOpenChange={(open) => !open && setOpenVersion(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("historyPreviewTitle")}</DialogTitle>
            <DialogDescription>
              {openVersion
                ? format.dateTime(new Date(openVersion.createdAt), {
                    dateStyle: "full",
                    timeStyle: "medium",
                  })
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border px-4 py-3">
            {openVersion ? <VersionPreview content={openVersion.content} /> : null}
          </div>

          <DialogFooter className="sm:flex-col sm:items-stretch sm:gap-2">
            <p className="text-xs text-muted-foreground">{t("historyRestoreDescription")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenVersion(null)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={() => void handleRestore()} disabled={restoring}>
                {restoring ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                {t("historyRestore")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
