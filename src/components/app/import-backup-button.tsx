"use client";

import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportBackup } from "@/hooks/use-import-backup";
import { cn } from "@/lib/utils";

// Shared "Import" button (Markdown/zip backup) — a hidden file input plus a
// button. Used by both the Documents page header and Settings > Backup.
export function ImportBackupButton({
  label,
  variant = "outline",
  className,
}: {
  label?: string;
  variant?: "outline" | "default" | "ghost";
  className?: string;
}) {
  const t = useTranslations();
  const { importing, inputRef, triggerImport, handleInputChange } = useImportBackup();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.json,.anvilnote,.zip"
        className="hidden"
        onChange={handleInputChange}
      />
      <Button
        variant={variant}
        onClick={triggerImport}
        disabled={importing}
        className={cn("gap-1.5", className)}
      >
        {importing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        <span className="hidden sm:inline">
          {label ?? t("settings.backup.import")}
        </span>
      </Button>
    </>
  );
}
