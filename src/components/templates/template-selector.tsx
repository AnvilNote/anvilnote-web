"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TemplateCard } from "@/components/templates/template-card";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";

export function TemplateSelector({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === documentId),
  );
  const setTemplate = useDocumentStore((s) => s.setTemplate);
  const templates = useTemplatesStore((s) => s.templates);
  const error = useTemplatesStore((s) => s.error);

  if (!doc) return null;

  function choose(id: string, name: string) {
    if (!doc || id === doc.templateId) return;
    setTemplate(doc.id, id);
    toast.success(t("toast.templateSwitched", { name }));
  }

  if (error) {
    return <p className="px-1 py-2 text-sm text-destructive">{error}</p>;
  }

  const nameOf = (name: string) => (tt.has(name as never) ? tt(name as never) : name);

  return (
    <div className="grid gap-3">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          selected={template.id === doc.templateId}
          onSelect={() => choose(template.id, nameOf(template.name))}
          document={doc}
        />
      ))}
    </div>
  );
}
