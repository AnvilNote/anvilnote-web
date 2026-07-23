"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  DatabaseBackup,
  Download,
  FileText,
  History,
  Loader2,
  Moon,
  Palette,
  Paintbrush,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SettingsRow } from "@/components/settings/settings-section";
import { FolderPicker } from "@/components/settings/folder-picker";
import { AISettingsSection } from "@/components/settings/ai-settings-section";
import { ColorPalettesSettings } from "@/components/settings/color-palettes-settings";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { ImportBackupButton } from "@/components/app/import-backup-button";
import { isDesktopShell, useAppVersion } from "@/components/app/app-version";
import { useMounted } from "@/hooks/use-mounted";
import {
  useSettingsStore,
  VERSION_SNAPSHOT_INTERVAL_OPTIONS,
  type VersionSnapshotIntervalMinutes,
} from "@/lib/stores/settings-store";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { selectHasUpdate, useUpdateStore } from "@/lib/stores/update-store";
import { LATEST_RELEASE_PAGE_URL } from "@/lib/update-check";
import { exportAllBackup } from "@/lib/export/backup";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";
import {
  useSettingsDialogStore,
  type SettingsCategoryId,
} from "@/lib/stores/ui-store";

// Each category's nav icon; title/description/content are resolved inside
// the component since most need hooks (translations, store state).
const CATEGORY_ICONS: Record<SettingsCategoryId, typeof Palette> = {
  appearance: Palette,
  language: Type,
  ai: Sparkles,
  documentDefaults: FileText,
  versionHistory: History,
  export: Download,
  colorPalettes: Paintbrush,
  backup: DatabaseBackup,
  update: RefreshCw,
};

type SearchEntry = { categoryId: SettingsCategoryId; rowId: string; label: string };

// Cheap subsequence-based fuzzy match: every character of the query must
// appear in the label in order (not necessarily contiguous). Good enough
// for a short, hand-written list of setting labels — no need to pull in a
// fuzzy-search dependency for this. Lower score = better match.
function fuzzyScore(query: string, label: string): number | null {
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (!q) return null;
  let li = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = l.indexOf(q[qi], li);
    if (idx === -1) return null;
    if (firstMatch === -1) firstMatch = idx;
    lastMatch = idx;
    li = idx + 1;
  }
  // Tighter matches (query letters close together) and earlier matches
  // both score better.
  return lastMatch - firstMatch + firstMatch * 0.1;
}

export function SettingsDialog() {
  const t = useTranslations();
  const open = useSettingsDialogStore((s) => s.open);
  const category = useSettingsDialogStore((s) => s.category);
  const closeSettings = useSettingsDialogStore((s) => s.closeSettings);
  const setCategory = useSettingsDialogStore((s) => s.setSettingsCategory);

  const settings = useSettingsStore();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const documents = useDocumentStore((s) => s.documents);
  const projects = useProjectStore((s) => s.projects);
  const [backingUp, setBackingUp] = useState(false);
  const version = useAppVersion();
  const hasUpdate = useUpdateStore(selectHasUpdate(version));
  const isDesktop = isDesktopShell();

  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const searchEntries: SearchEntry[] = [
    { categoryId: "appearance", rowId: "appearance-theme", label: t("settings.appearance.theme") },
    { categoryId: "appearance", rowId: "appearance-tourButton", label: t("settings.appearance.tourButton") },
    { categoryId: "appearance", rowId: "appearance-holidayEffects", label: t("settings.appearance.holidayEffects") },
    { categoryId: "language", rowId: "language", label: t("settings.language.title") },
    { categoryId: "ai", rowId: "ai-provider", label: t("ai.settings.provider") },
    { categoryId: "ai", rowId: "ai-model", label: t("ai.settings.model") },
    { categoryId: "ai", rowId: "ai-api-key", label: t("ai.settings.apiKey") },
    { categoryId: "ai", rowId: "ai-default-style", label: t("ai.settings.defaultStyle") },
    { categoryId: "documentDefaults", rowId: "doc-author", label: t("settings.documentDefaults.author") },
    { categoryId: "versionHistory", rowId: "version-interval", label: t("settings.versionHistory.title") },
    { categoryId: "export", rowId: "export-pageSize", label: t("settings.export.pageSize") },
    { categoryId: "export", rowId: "export-fontPreset", label: t("settings.export.fontPreset") },
    { categoryId: "export", rowId: "export-storageLocation", label: t("settings.export.storageLocation") },
    { categoryId: "backup", rowId: "backup-all", label: t("settings.backup.allDocuments") },
    { categoryId: "backup", rowId: "backup-import", label: t("settings.backup.import") },
    ...(isDesktop
      ? [{ categoryId: "update" as const, rowId: "update-version", label: t("settings.update.title") }]
      : []),
  ];

  const searchResults = searchEntries
    .map((entry) => ({ entry, score: fuzzyScore(searchQuery, entry.label) }))
    .filter((r): r is { entry: SearchEntry; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((r) => r.entry);

  function goToSearchResult(entry: SearchEntry) {
    setCategory(entry.categoryId);
    setSearchQuery("");
    // Double rAF: switching category can remount the content pane (e.g. the
    // AI panel refetches), so wait for that render + paint before measuring
    // and scrolling to the target row.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = contentRef.current?.querySelector<HTMLElement>(`#${CSS.escape(entry.rowId)}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedRowId(entry.rowId);
        window.setTimeout(() => setHighlightedRowId(null), 3000);
      });
    });
  }

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
  // hits Save.
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

  function saveExportDefaults() {
    settings.setExportPageSize(draftPageSize);
    settings.setExportFontPreset(draftFontPreset);
    settings.setExportStorageLocation(draftStorageLocation);
    toast.success(t("toast.settingsSaved"));
  }

  type Category = {
    id: SettingsCategoryId;
    title: string;
    description: string;
    content: ReactNode;
  };

  const allCategories: Category[] = [
    {
      id: "appearance",
      title: t("settings.appearance.title"),
      description: t("settings.appearance.description"),
      content: (
        <>
          <SettingsRow
            id="appearance-theme"
            highlighted={highlightedRowId === "appearance-theme"}
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
          <SettingsRow
            id="appearance-tourButton"
            highlighted={highlightedRowId === "appearance-tourButton"}
            label={t("settings.appearance.tourButton")}
            hint={t("settings.appearance.tourButtonHint")}
            control={
              <Switch
                checked={!settings.hideTourButton}
                aria-label={t("settings.appearance.tourButton")}
                onCheckedChange={(checked) => settings.setHideTourButton(!checked)}
              />
            }
          />
          <SettingsRow
            id="appearance-holidayEffects"
            highlighted={highlightedRowId === "appearance-holidayEffects"}
            label={t("settings.appearance.holidayEffects")}
            hint={t("settings.appearance.holidayEffectsHint")}
            control={
              <Switch
                checked={settings.holidayEffectsEnabled}
                aria-label={t("settings.appearance.holidayEffects")}
                onCheckedChange={(checked) => settings.setHolidayEffectsEnabled(checked)}
              />
            }
          />
          {settings.tourButtonPosition ? (
            <SettingsRow
              label={t("settings.appearance.tourButtonPosition")}
              hint={t("settings.appearance.tourButtonPositionHint")}
              control={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => settings.setTourButtonPosition(null)}
                >
                  {t("settings.appearance.tourButtonPositionReset")}
                </Button>
              }
            />
          ) : null}
        </>
      ),
    },
    {
      id: "language",
      title: t("settings.language.title"),
      description: t("settings.language.description"),
      content: (
        <SettingsRow
          id="language"
          highlighted={highlightedRowId === "language"}
          label={t("settings.language.label")}
          control={<LocaleSwitcher />}
        />
      ),
    },
    {
      id: "ai",
      title: t("ai.settings.title"),
      description: t("ai.settings.description"),
      content: <AISettingsSection highlightedRowId={highlightedRowId} />,
    },
    {
      id: "documentDefaults",
      title: t("settings.documentDefaults.title"),
      description: t("settings.documentDefaults.description"),
      content: (
        <SettingsRow
          id="doc-author"
          highlighted={highlightedRowId === "doc-author"}
          label={t("settings.documentDefaults.author")}
          hint={t("settings.documentDefaults.authorHint")}
          control={
            <Input
              className="w-56"
              onChange={(event) => settings.setDefaultAuthor(event.target.value)}
              placeholder={t("settings.documentDefaults.authorPlaceholder")}
              value={settings.defaultAuthor}
            />
          }
        />
      ),
    },
    {
      id: "versionHistory",
      title: t("settings.versionHistory.title"),
      description: t("settings.versionHistory.description"),
      content: (
        <SettingsRow
          id="version-interval"
          highlighted={highlightedRowId === "version-interval"}
          label={t("settings.versionHistory.interval")}
          hint={t("settings.versionHistory.intervalHint")}
          control={
            <Select
              value={String(settings.versionSnapshotIntervalMinutes)}
              onValueChange={(v) =>
                settings.setVersionSnapshotIntervalMinutes(
                  Number(v) as VersionSnapshotIntervalMinutes,
                )
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {VERSION_SNAPSHOT_INTERVAL_OPTIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes === 0
                      ? t("settings.versionHistory.off")
                      : t("settings.versionHistory.every", { minutes })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      ),
    },
    {
      id: "export",
      title: t("settings.export.title"),
      description: t("settings.export.description"),
      content: (
        <>
          <SettingsRow
            id="export-pageSize"
            highlighted={highlightedRowId === "export-pageSize"}
            label={t("settings.export.pageSize")}
            control={
              <Select
                value={draftPageSize}
                onValueChange={(v) => setDraftPageSize(v as ExportPageSize)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="Letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            id="export-fontPreset"
            highlighted={highlightedRowId === "export-fontPreset"}
            label={t("settings.export.fontPreset")}
            control={
              <Select
                value={draftFontPreset}
                onValueChange={(v) => setDraftFontPreset(v as ExportFontPreset)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="sans">{t("export.fonts.sans")}</SelectItem>
                  <SelectItem value="serif">{t("export.fonts.serif")}</SelectItem>
                  <SelectItem value="mono">{t("export.fonts.mono")}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            id="export-storageLocation"
            highlighted={highlightedRowId === "export-storageLocation"}
            label={t("settings.export.storageLocation")}
            hint={t("settings.export.storageLocationHint")}
            control={
              <FolderPicker value={draftStorageLocation} onChange={setDraftStorageLocation} />
            }
          />
          <div className="flex justify-end pt-3">
            <Button onClick={saveExportDefaults} disabled={!exportDirty}>
              {t("settings.save")}
            </Button>
          </div>
        </>
      ),
    },
    {
      id: "colorPalettes",
      title: t("settings.colorPalettes.title"),
      description: t("settings.colorPalettes.description"),
      content: <ColorPalettesSettings />,
    },
    {
      id: "backup",
      title: t("settings.backup.title"),
      description: t("settings.backup.description"),
      content: (
        <>
          <SettingsRow
            id="backup-all"
            highlighted={highlightedRowId === "backup-all"}
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
            id="backup-import"
            highlighted={highlightedRowId === "backup-import"}
            label={t("settings.backup.import")}
            hint={t("settings.backup.importHint")}
            control={<ImportBackupButton label={t("settings.backup.importButton")} />}
          />
        </>
      ),
    },
    {
      id: "update",
      title: t("settings.update.title"),
      description: t("settings.update.description"),
      content: (
        <SettingsRow
          id="update-version"
          highlighted={highlightedRowId === "update-version"}
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
      ),
    },
  ];

  const categories = allCategories.filter((c) => c.id !== "update" || isDesktop);

  const active = categories.find((c) => c.id === category) ?? categories[0];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeSettings()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[36rem] max-h-[85vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10">
            <X className="size-4" />
            <span className="sr-only">{t("common.close")}</span>
          </Button>
        </DialogClose>
        <div className="flex min-h-0 flex-1">
          <nav className="w-48 shrink-0 overflow-y-auto border-r bg-muted/30 p-2">
            <div className="pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("settings.title")}
                  className="h-8 pl-7 text-xs"
                />
                {searchResults.length > 0 ? (
                  <div className="absolute inset-x-0 top-full z-20 mt-1 space-y-0.5 rounded-md border bg-popover p-1 shadow-md">
                    {searchResults.map(({ categoryId, rowId, label }) => (
                      <button
                        key={rowId}
                        type="button"
                        onClick={() => goToSearchResult({ categoryId, rowId, label })}
                        className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-0.5">
              {categories.map((c) => {
                const Icon = CATEGORY_ICONS[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      c.id === active.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
              <div className="space-y-1">
                <DialogTitle className="text-base font-semibold">{active.title}</DialogTitle>
                <DialogDescription>{active.description}</DialogDescription>
              </div>
            </div>
            <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {active.content}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
