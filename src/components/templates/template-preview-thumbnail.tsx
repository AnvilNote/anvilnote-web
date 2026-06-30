"use client";

import { useState } from "react";
import Image from "next/image";
import { FileText } from "lucide-react";
import type { AnvilTemplate } from "@/types/template";
import { getTemplatePreview } from "@/lib/templates/preview";
import { cn } from "@/lib/utils";

// A small paper-like preview of the template's first page. Falls back to a
// generic document icon if the thumbnail is missing, so a card never breaks.
export function TemplatePreviewThumbnail({
  template,
  displayName,
  className,
}: {
  template: AnvilTemplate;
  displayName: string;
  className?: string;
}) {
  const { thumbnailUrl } = getTemplatePreview(template);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border bg-card",
        className,
      )}
    >
      {failed ? (
        <FileText className="size-8 text-muted-foreground/40" />
      ) : (
        <Image
          src={thumbnailUrl}
          alt={displayName}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover object-top"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
