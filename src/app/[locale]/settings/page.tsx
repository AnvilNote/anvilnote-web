"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { DatabaseBackup, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-section";
import { FolderPicker } from "@/components/settings/folder-picker";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { ImportBackupButton } from "@/components/app/import-backup-button";
import { isDesktopShell, useAppVersion } from "@/components/app/app-version";
import { useMounted } from "@/hooks/use-mounted";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { selectHasUpdate, useUpdateStore } from "@/lib/stores/update-store";
import { LATEST_RELEASE_PAGE_URL } from "@/lib/update-check";
import { exportAllBackup } from "@/lib/export/backup";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";

export default function SettingsPage() {
  const t = useTranslations();
  const settings = useSettingsStore();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const documents = useDocumentStore((s) => s.documents);
  const projects = useProjectStore((s) => s.projects);
  const [backingUp, setBackingUp] = useState(false);
  const version = useAppVersion();
  const hasUpdate = useUpdateStore(selectHasUpdate(version));
  const isDesktop = isDesktopShell();

  async function backupAll() {
    setBackingUp(true);
    try {
      const result = await exportAllBackup(documents, projects, t("projects.unfiled"));
      toast.success(
        result.kind === "folder"
          ? t("toast.exportSavedTo", { path: result.path })
          : t("toast.exportDownloaded", { name: result.fileName }),
      );
    } catch {
      toast.error(t("toast.exportFailed"));
    } finally {
      setBackingUp(false);
    }
  }

  // Export defaults are edited as a draft and only persisted when the user
  // hits Save. The store is already rehydrated by StoreHydrator before this
  // page renders, so seeding from it directly is safe.
  const [draftPageSize, setDraftPageSize] = useState<ExportPageSize>(
    settings.exportPageSize,
  );
  const [draftFontPreset, setDraftFontPreset] = useState<ExportFontPreset>(
    settings.exportFontPreset,
  );
  const [draftStorageLocation, setDraftStorageLocation] = useState(
    settings.exportStorageLocation,
  );

  const exportDirty =
    draftPageSize !== settings.exportPageSize ||
    draftFontPreset !== settings.exportFontPreset ||
    draftStorageLocation !== settings.exportStorageLocation;

  function saved() {
    toast.success(t("toast.settingsSaved"));
  }

  function saveExportDefaults() {
    settings.setExportPageSize(draftPageSize);
    settings.setExportFontPreset(draftFontPreset);
    settings.setExportStorageLocation(draftStorageLocation);
    saved();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="mt-4">
        <SettingsSection
          title={t("settings.appearance.title")}
          description={t("settings.appearance.description")}
        >
          <SettingsRow
            label={t("settings.appearance.theme")}
            hint={t("settings.appearance.themeHint")}
            control={
              <div className="flex items-center gap-2">
                <Sun className="size-4 text-muted-foreground" />
                <Switch
                  checked={mounted ? resolvedTheme === "dark" : false}
                  aria-label={t("settings.appearance.theme")}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
                <Moon className="size-4 text-muted-foreground" />
              </div>
            }
          />
        </SettingsSection>

        <SettingsSection
          title={t("settings.language.title")}
          description={t("settings.language.description")}
        >
          <SettingsRow
            label={t("settings.language.label")}
            control={<LocaleSwitcher />}
          />
        </SettingsSection>

        <SettingsSection
          title={t("settings.export.title")}
          description={t("settings.export.description")}
        >
          <SettingsRow
            label={t("settings.export.pageSize")}
            control={
              <Select
                value={draftPageSize}
                onValueChange={(v) => setDraftPageSize(v as ExportPageSize)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="Letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            label={t("settings.export.fontPreset")}
            control={
              <Select
                value={draftFontPreset}
                onValueChange={(v) => setDraftFontPreset(v as ExportFontPreset)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans">{t("export.fonts.sans")}</SelectItem>
                  <SelectItem value="serif">{t("export.fonts.serif")}</SelectItem>
                  <SelectItem value="mono">{t("export.fonts.mono")}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            label={t("settings.export.storageLocation")}
            hint={t("settings.export.storageLocationHint")}
            control={
              <FolderPicker
                value={draftStorageLocation}
                onChange={setDraftStorageLocation}
              />
            }
          />
          <div className="flex justify-end">
            <Button onClick={saveExportDefaults} disabled={!exportDirty}>
              {t("settings.save")}
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection
          title={t("settings.backup.title")}
          description={t("settings.backup.description")}
        >
          <SettingsRow
            label={t("settings.backup.allDocuments")}
            hint={t("settings.backup.allDocumentsHint", { count: documents.length })}
            control={
              <Button
                onClick={() => void backupAll()}
                disabled={backingUp || documents.length === 0}
                className="gap-1.5"
              >
                {backingUp ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <DatabaseBackup className="size-4" />
                )}
                {t("settings.backup.button")}
              </Button>
            }
          />
          <SettingsRow
            label={t("settings.backup.import")}
            hint={t("settings.backup.importHint")}
            control={<ImportBackupButton label={t("settings.backup.importButton")} />}
          />
        </SettingsSection>

        {isDesktop ? (
          <SettingsSection
            title={t("settings.update.title")}
            description={t("settings.update.description")}
          >
            <SettingsRow
              label={t("settings.update.currentVersion", { version })}
              hint={hasUpdate ? t("settings.update.available") : t("settings.update.upToDate")}
              control={
                hasUpdate ? (
                  <Button asChild size="sm">
                    <a href={LATEST_RELEASE_PAGE_URL} target="_blank" rel="noopener noreferrer">
                      {t("settings.update.download")}
                    </a>
                  </Button>
                ) : null
              }
            />
          </SettingsSection>
        ) : null}
      </div>
    </div>
  );
}
