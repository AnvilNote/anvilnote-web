"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { DocumentActions } from "@/components/app/document-actions";

export default function DocumentsPage() {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const format = useFormatter();
  const router = useRouter();

  const documents = useDocumentStore((s) => s.documents);
  const hydrated = useDocumentStore((s) => s.hydrated);
  const createDocument = useDocumentStore((s) => s.createDocument);
  const getTemplate = useTemplatesStore((s) => s.getTemplate);

  async function handleNew() {
    const doc = await createDocument(undefined, t("documents.defaultTitle"), {
      heading: t("documents.defaultHeading"),
      body: t("documents.defaultBody"),
    });
    router.push(`/documents/${doc.id}`);
    toast.success(t("toast.documentCreated"));
  }

  if (!hydrated) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("documents.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("documents.subtitle")}
          </p>
        </div>
        <Button onClick={() => void handleNew()} className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t("documents.newDocument")}</span>
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        {t("documents.count", { count: documents.length })}
      </p>

      {documents.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <p className="text-sm font-medium">{t("documents.empty")}</p>
          <p className="text-sm text-muted-foreground">
            {t("documents.emptyHint")}
          </p>
          <Button onClick={() => void handleNew()} variant="outline" className="gap-1.5">
            <Plus className="size-4" />
            {t("documents.newDocument")}
          </Button>
        </div>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border">
          {documents.map((doc) => {
            const template = getTemplate(doc.templateId);
            const templateName = template
              ? tt.has(template.name as never)
                ? tt(template.name as never)
                : template.name
              : doc.templateId;
            return (
              <li
                key={doc.id}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <Link
                  href={`/documents/${doc.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-medium">
                    {doc.title || t("documents.untitled")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {templateName} ·{" "}
                    {t("documents.lastEdited", {
                      date: format.dateTime(new Date(doc.updatedAt), {
                        dateStyle: "medium",
                      }),
                    })}
                  </p>
                </Link>
                <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <DocumentActions doc={doc} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
