"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
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
import { useMounted } from "@/hooks/use-mounted";
import { useSettingsStore } from "@/lib/stores/settings-store";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";

export default function SettingsPage() {
  const t = useTranslations();
  const settings = useSettingsStore();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

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
      </div>
    </div>
  );
}
