"use client";

import { useEffect } from "react";
import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { useSmartModeUIStore } from "@/lib/stores/smart-mode-ui-store";
import { SmartModePanel } from "./smart-mode-panel";

export function SmartModeLauncher() {
  const t = useTranslations("ai");
  const editor = useEditorBridge((state) => state.editor);
  const open = useSmartModeUIStore((state) => state.open);
  const setOpen = useSmartModeUIStore((state) => state.setOpen);

  useEffect(() => () => setOpen(false), [setOpen]);

  if (!editor) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className={cn(
                "fixed right-[max(12px,env(safe-area-inset-right))] bottom-[max(12px,env(safe-area-inset-bottom))] z-[56] size-11 rounded-full bg-background shadow-lg transition-opacity sm:right-4 sm:bottom-4",
                open && "pointer-events-none invisible opacity-0",
              )}
              aria-label={t("smart.open")}
              aria-expanded={open}
              aria-controls="smart-mode-panel"
            >
              <Bot className="size-5" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">{t("smart.open")}</TooltipContent>
      </Tooltip>
      <SmartModePanel open={open} onOpenChange={setOpen} />
    </Sheet>
  );
}
