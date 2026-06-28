"use client";

import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExportPayload } from "@/types/export";

export function ExportPayloadPreview({ payload }: { payload: ExportPayload }) {
  const t = useTranslations("export");

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{t("payloadTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("payloadHint")}</p>
      </div>
      <ScrollArea className="h-64 rounded-lg border bg-muted/30">
        <pre className="p-3 font-mono text-xs leading-relaxed text-foreground">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
}
