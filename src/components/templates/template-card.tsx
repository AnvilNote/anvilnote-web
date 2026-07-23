"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TemplatePreviewButton } from "@/components/templates/template-preview-button";
import type { AnvilTemplate } from "@/types/template";
import type { AnvilDocument } from "@/types/document";
import { cn } from "@/lib/utils";

export function TemplateCard({
  template,
  selected,
  onSelect,
  document,
}: {
  template: AnvilTemplate;
  selected: boolean;
  onSelect: () => void;
  document?: AnvilDocument;
}) {
  const t = useTranslations("templates");
  const tr = (key: string) => (t.has(key as never) ? t(key as never) : key);
  const displayName = tr(template.name);
  const description = tr(template.description);

  // Root is a clickable div (role=button) rather than a real <button> so the
  // preview's eye button can nest without invalid nested-interactive markup.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-foreground ring-1 ring-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{displayName}</span>
        <div className="flex shrink-0 items-center gap-1">
          <TemplatePreviewButton
            template={template}
            displayName={displayName}
            description={description}
            onUseTemplate={onSelect}
            className="size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            document={document}
          />
          {selected ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3" />
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Badge variant="secondary" className="font-normal">
          {tr(`categories.${template.category}`)}
        </Badge>
        {selected ? (
          <span className="text-xs text-muted-foreground">{t("inUse")}</span>
        ) : null}
      </div>
    </div>
  );
}
