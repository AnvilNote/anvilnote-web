"use client";

import { useState } from "react";
import { GraduationCap, HelpCircle, SquareChartGantt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTourStore } from "@/lib/stores/tour-store";
import { CheatSheetModal } from "@/components/tour/cheat-sheet-modal";
import { cn } from "@/lib/utils";

export function TourReplayButton() {
  const t = useTranslations("tour");
  const active = useTourStore((s) => s.active);
  const start = useTourStore((s) => s.start);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);

  if (active) return null;

  return (
    <>
      <div
        className="group fixed right-5 bottom-5 z-[55] hidden flex-col items-center gap-2 lg:flex"
        data-tour="help-menu"
      >
        <button
          type="button"
          onClick={() => setCheatSheetOpen(true)}
          aria-label={t("cheatSheet")}
          title={t("cheatSheet")}
          className={cn(
            "flex size-10 scale-90 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-lg transition-all duration-150",
            "hover:text-foreground group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100",
            "translate-y-2",
          )}
        >
          <SquareChartGantt className="size-4" />
        </button>
        <button
          type="button"
          onClick={start}
          aria-label={t("replay")}
          title={t("replay")}
          className={cn(
            "flex size-10 scale-90 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-lg transition-all duration-150",
            "hover:text-foreground group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100",
            "translate-y-2",
          )}
        >
          <GraduationCap className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t("helpMenu")}
          title={t("helpMenu")}
          className="flex size-11 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-lg transition-colors hover:text-foreground"
        >
          <HelpCircle className="size-5" />
        </button>
      </div>

      <CheatSheetModal open={cheatSheetOpen} onOpenChange={setCheatSheetOpen} />
    </>
  );
}
