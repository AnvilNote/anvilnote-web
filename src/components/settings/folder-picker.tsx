"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Common user folders. Chrome blocks these in `showDirectoryPicker` ("folder
// contains system files"), so we offer them as direct choices — no browser
// dialog — and reserve the native picker for arbitrary folders.
const COMMON_FOLDERS = ["Downloads", "Desktop", "Documents"];
const PICK_OTHER = "__pick_other__";

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<{ name: string }>;
};

export function FolderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations("settings.export");

  // Show the current value as its own item when it isn't one of the presets
  // (e.g. a folder chosen via the native picker).
  const isCustom = value !== "" && !COMMON_FOLDERS.includes(value);

  async function pickNative() {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      toast.error(t("folderUnsupported"));
      return;
    }
    try {
      const handle = await picker();
      onChange(handle.name);
      toast.success(t("folderSelected", { folder: handle.name }));
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      toast.error(t("folderBlocked"));
    }
  }

  function onValueChange(next: string) {
    if (next === PICK_OTHER) {
      void pickNative();
      return;
    }
    onChange(next);
    toast.success(t("folderSelected", { folder: next }));
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {COMMON_FOLDERS.map((folder) => (
          <SelectItem key={folder} value={folder}>
            {folder}
          </SelectItem>
        ))}
        {isCustom ? <SelectItem value={value}>{value}</SelectItem> : null}
        <SelectSeparator />
        <SelectItem value={PICK_OTHER}>{t("pickOther")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
