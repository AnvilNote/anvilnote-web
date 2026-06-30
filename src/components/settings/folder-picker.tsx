"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import {
  getExportDirName,
  pickExportDir,
  supportsFileSystemAccess,
} from "@/lib/export-target";

// Lets the user pick a folder to export into. We keep the folder's directory
// handle (in IndexedDB) so exports can create an "AnvilNote" subfolder inside it
// and write the PDF there. `value` is the folder's display name, mirrored into
// settings so the choice is visible elsewhere.
export function FolderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations("settings.export");
  const mounted = useMounted();
  // Optimistic before mount (avoids an SSR/hydration flash); real value after.
  const supported = !mounted || supportsFileSystemAccess();

  useEffect(() => {
    // Re-sync the label from the persisted handle (it's the source of truth).
    void getExportDirName().then((name) => {
      if (name && name !== value) onChange(name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick() {
    try {
      const name = await pickExportDir();
      onChange(name);
      toast.success(t("folderSelected", { folder: name }));
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      if ((error as Error)?.message === "unsupported") {
        toast.error(t("folderUnsupported"));
        return;
      }
      toast.error(t("folderBlocked"));
    }
  }

  if (!supported) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("folderUnsupported")}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="max-w-[10rem] truncate text-sm text-muted-foreground"
        title={value}
      >
        {value || t("folderNotSet")}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => void pick()}
      >
        <FolderOpen className="size-4" />
        {t("chooseFolder")}
      </Button>
    </div>
  );
}
