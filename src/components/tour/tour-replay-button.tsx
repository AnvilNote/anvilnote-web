"use client";

import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTourStore } from "@/lib/stores/tour-store";

export function TourReplayButton() {
  const t = useTranslations("tour");
  const active = useTourStore((s) => s.active);
  const start = useTourStore((s) => s.start);

  if (active) return null;

  return (
    <button
      type="button"
      onClick={start}
      aria-label={t("replay")}
      title={t("replay")}
      className="fixed right-5 bottom-5 z-[55] hidden size-11 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-lg transition-colors hover:text-foreground lg:flex"
    >
      <HelpCircle className="size-5" />
    </button>
  );
}
