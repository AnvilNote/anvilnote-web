"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useRouter } from "@/lib/i18n/navigation";

export function EditorEmptyState() {
  const t = useTranslations();
  const router = useRouter();
  const createDocument = useDocumentStore((s) => s.createDocument);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm space-y-3">
        <h2 className="text-lg font-medium">{t("editor.emptyTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.emptyDescription")}
        </p>
        <Button
          className="gap-1.5"
          onClick={() => {
            void createDocument(undefined, t("documents.defaultTitle"), {
              heading: t("documents.defaultHeading"),
              body: t("documents.defaultBody"),
            }).then((doc) => {
            router.push(`/documents/${doc.id}`);
            toast.success(t("toast.documentCreated"));
            });
          }}
        >
          <Plus className="size-4" />
          {t("editor.createDocument")}
        </Button>
      </div>
    </div>
  );
}
