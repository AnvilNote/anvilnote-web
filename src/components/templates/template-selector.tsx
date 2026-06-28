"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TemplateCard } from "@/components/templates/template-card";
import { TEMPLATES } from "@/lib/templates/templates";
import { useDocumentStore } from "@/lib/stores/document-store";

export function TemplateSelector({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === documentId),
  );
  const setTemplate = useDocumentStore((s) => s.setTemplate);

  if (!doc) return null;

  function choose(id: string, name: string) {
    if (!doc || id === doc.templateId) return;
    setTemplate(doc.id, id);
    toast.success(t("toast.templateSwitched", { name }));
  }

  return (
    <div className="grid gap-3">
      {TEMPLATES.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          selected={template.id === doc.templateId}
          onSelect={() => choose(template.id, tt(template.name as never))}
        />
      ))}
    </div>
  );
}
