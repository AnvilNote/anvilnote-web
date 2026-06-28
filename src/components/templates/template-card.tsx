"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnvilTemplate } from "@/types/template";
import { cn } from "@/lib/utils";

export function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: AnvilTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("templates");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40",
        selected && "border-foreground ring-1 ring-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{t(template.name as never)}</span>
        {selected ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t(template.description as never)}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Badge variant="secondary" className="font-normal">
          {t(`categories.${template.category}`)}
        </Badge>
        {selected ? (
          <span className="text-xs text-muted-foreground">{t("inUse")}</span>
        ) : null}
      </div>
    </button>
  );
}
