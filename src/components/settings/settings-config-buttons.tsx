"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { exportSettingsConfig, importSettingsConfig } from "@/lib/settings-config";

/** Export/import the whole app settings state as a `.config` file — lives
 * in the Backup settings section alongside the other whole-app backup
 * actions, not inside any individual settings section (list markers, AI,
 * etc.) whose own values it happens to include. */
export function SettingsConfigButtons() {
  const t = useTranslations("settings.backup");
  const tCommon = useTranslations("common");
  const importInputRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);

  async function handleExport() {
    try {
      await exportSettingsConfig(useSettingsStore.getState());
    } catch {
      toast.error(t("configExportError"));
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = await importSettingsConfig(await file.text());
      useSettingsStore.setState(imported);
      toast.success(t("configImportSuccess"));
    } catch {
      toast.error(t("configImportError"));
    }
  }

  return (
    <div className="flex gap-2">
      <Button onClick={() => void handleExport()} size="sm" variant="outline">
        <Download className="size-3.5" />
        {t("configExport")}
      </Button>
      <Button onClick={() => importInputRef.current?.click()} size="sm" variant="outline">
        <Upload className="size-3.5" />
        {t("configImport")}
      </Button>
      <Button onClick={() => setResetOpen(true)} size="sm" variant="outline">
        <RotateCcw className="size-3.5" />
        {t("resetAll")}
      </Button>
      <input
        accept=".config,application/json"
        className="hidden"
        onChange={(event) => void handleImportFile(event)}
        ref={importInputRef}
        type="file"
      />

      <Dialog onOpenChange={setResetOpen} open={resetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("resetAllConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("resetAllConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setResetOpen(false)} variant="outline">
              {tCommon("cancel")}
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90"
              onClick={() => {
                useSettingsStore.getState().resetAllSettings();
                setResetOpen(false);
                toast.success(t("resetAllSuccess"));
              }}
              variant="destructive"
            >
              {t("resetAll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
