"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { useMounted } from "@/hooks/use-mounted";
import { useSettingsStore } from "@/lib/stores/settings-store";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";

export default function SettingsPage() {
  const t = useTranslations();
  const settings = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  function saved() {
    toast.success(t("toast.settingsSaved"));
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
              <ToggleGroup
                type="single"
                variant="outline"
                value={mounted ? theme : undefined}
                onValueChange={(value) => {
                  if (!value) return;
                  setTheme(value);
                  saved();
                }}
              >
                <ToggleGroupItem
                  value="light"
                  aria-label={t("settings.appearance.themeLight")}
                >
                  <Sun className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dark"
                  aria-label={t("settings.appearance.themeDark")}
                >
                  <Moon className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="system"
                  aria-label={t("settings.appearance.themeSystem")}
                >
                  <Monitor className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            }
          />
          <SettingsRow
            label={t("settings.appearance.mode")}
            control={
              <Badge variant="secondary" className="font-normal">
                {t("settings.appearance.monochrome")}
              </Badge>
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
          title={t("settings.editor.title")}
          description={t("settings.editor.description")}
        >
          <SettingsRow
            label={t("settings.editor.autosave")}
            hint={t("settings.editor.autosaveHint")}
            control={
              <Switch
                checked={settings.autosave}
                onCheckedChange={(v) => {
                  settings.setAutosave(v);
                  saved();
                }}
              />
            }
          />
          <SettingsRow
            label={t("settings.editor.spellcheck")}
            hint={t("settings.editor.spellcheckHint")}
            control={
              <Switch
                checked={settings.spellcheck}
                onCheckedChange={(v) => {
                  settings.setSpellcheck(v);
                  saved();
                }}
              />
            }
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
                value={settings.exportPageSize}
                onValueChange={(v) => {
                  settings.setExportPageSize(v as ExportPageSize);
                  saved();
                }}
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
                value={settings.exportFontPreset}
                onValueChange={(v) => {
                  settings.setExportFontPreset(v as ExportFontPreset);
                  saved();
                }}
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
            label={t("settings.export.includeMetadata")}
            control={
              <Switch
                checked={settings.exportIncludeMetadata}
                onCheckedChange={(v) => {
                  settings.setExportIncludeMetadata(v);
                  saved();
                }}
              />
            }
          />
        </SettingsSection>
      </div>
    </div>
  );
}
