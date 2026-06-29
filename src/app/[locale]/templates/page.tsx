"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";

export default function TemplatesPage() {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const router = useRouter();
  const createDocument = useDocumentStore((s) => s.createDocument);
  const templates = useTemplatesStore((s) => s.templates);
  const error = useTemplatesStore((s) => s.error);
  const tr = (key: string) => (tt.has(key as never) ? tt(key as never) : key);

  async function startFromTemplate(id: string, name: string) {
    const doc = await createDocument(id, t("documents.defaultTitle"));
    router.push(`/documents/${doc.id}`);
    toast.success(t("toast.documentCreatedFromTemplate", { name }));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("templates.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("templates.subtitle")}</p>
      </div>

      {error ? (
        <p className="mt-8 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {tr(template.name)}
                  </CardTitle>
                  <Badge variant="secondary" className="font-normal">
                    {tr(`categories.${template.category}`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {tr(template.description)}
                </p>
                {template.fields.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {template.fields.map((field) => (
                      <Badge
                        key={field.key}
                        variant="outline"
                        className="font-normal text-muted-foreground"
                      >
                        {tr(field.label)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  className="mt-auto w-full justify-between"
                  onClick={() =>
                    void startFromTemplate(template.id, tr(template.name))
                  }
                >
                  {t("templates.use")}
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
