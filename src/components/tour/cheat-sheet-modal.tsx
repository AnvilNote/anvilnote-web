"use client";

import { useTranslations } from "next-intl";
import { SquareChartGantt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatChord,
  TOOLBAR_SHORTCUTS,
  type CheatSheetOs,
} from "@/config/toolbar-shortcuts";

const OS_LIST: CheatSheetOs[] = ["mac", "windows", "linux"];

export function CheatSheetModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("cheatSheet");
  const tToolbar = useTranslations("editor.toolbar");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-transparent backdrop-blur-none"
        className="flex h-[410px] w-full max-w-2xl flex-col gap-3 sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SquareChartGantt className="size-4" />
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="mac" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList className="grid w-full grid-cols-3">
            {OS_LIST.map((os) => (
              <TabsTrigger
                key={os}
                value={os}
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {t(`os.${os}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {OS_LIST.map((os) => (
            <TabsContent
              key={os}
              value={os}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <ul className="grid grid-cols-3 grid-rows-9 grid-flow-col gap-x-6">
                {TOOLBAR_SHORTCUTS.map(({ labelKey, icon: Icon, chord }) => (
                  <li
                    key={labelKey}
                    className="flex items-center justify-between gap-4 border-b py-1.5"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      {tToolbar(labelKey as never)}
                    </span>
                    {chord ? (
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {formatChord(chord, os)}
                      </kbd>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("noShortcut")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
