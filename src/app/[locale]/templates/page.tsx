"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "@/lib/i18n/navigation";
import { TEMPLATES } from "@/lib/templates/templates";
import { useDocumentStore } from "@/lib/stores/document-store";

export default function TemplatesPage() {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const router = useRouter();
  const createDocument = useDocumentStore((s) => s.createDocument);

  async function startFromTemplate(id: string, name: string) {
    const doc = await createDocument(id);
    router.push(`/documents/${doc.id}`);
    toast.success(t("toast.templateSwitched", { name }));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("templates.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("templates.subtitle")}</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {tt(template.name as never)}
                </CardTitle>
                <Badge variant="secondary" className="font-normal">
                  {tt(`categories.${template.category}`)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {tt(template.description as never)}
              </p>
              {template.fields.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {template.fields.map((field) => (
                    <Badge
                      key={field.key}
                      variant="outline"
                      className="font-normal text-muted-foreground"
                    >
                      {tt(field.label as never)}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <Button
                variant="outline"
                className="mt-auto w-full justify-between"
                onClick={() =>
                  void startFromTemplate(template.id, tt(template.name as never))
                }
              >
                {t("templates.use")}
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
