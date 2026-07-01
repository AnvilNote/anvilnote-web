"use client";

import { useTranslations } from "next-intl";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Shared "..." menu for a project row — used by the sidebar's project list
// and the /projects overview page. Currently just exposes delete; the group
// hover/focus visibility classes are the caller's responsibility since the
// two surfaces use different hover group names.
export function ProjectMenu({
  onDelete,
  triggerClassName,
}: {
  onDelete: () => void;
  triggerClassName?: string;
}) {
  const t = useTranslations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.open")}
          className={
            triggerClassName ??
            "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
          }
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem variant="destructive" className="font-medium" onSelect={onDelete}>
          <Trash2 className="size-4" />
          {t("projects.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
