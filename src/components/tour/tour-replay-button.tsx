"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, HelpCircle, SquareChartGantt, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTourStore } from "@/lib/stores/tour-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { CheatSheetModal } from "@/components/tour/cheat-sheet-modal";
import { cn } from "@/lib/utils";

const DEFAULT_POSITION = { right: 20, bottom: 20 };
const EDGE_MARGIN = 8;
// Pointer must move at least this far before a press-and-hold on the anchor
// icon counts as a drag rather than a click (the anchor itself has no
// onClick, but this also guards against firing a click on release).
const DRAG_THRESHOLD_PX = 4;

export function TourReplayButton() {
  const t = useTranslations("tour");
  const active = useTourStore((s) => s.active);
  const start = useTourStore((s) => s.start);
  const hidden = useSettingsStore((s) => s.hideTourButton);
  const setHideTourButton = useSettingsStore((s) => s.setHideTourButton);
  const savedPosition = useSettingsStore((s) => s.tourButtonPosition);
  const setTourButtonPosition = useSettingsStore((s) => s.setTourButtonPosition);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);

  const [position, setPosition] = useState(savedPosition ?? DEFAULT_POSITION);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setPosition(savedPosition ?? DEFAULT_POSITION);
  }, [savedPosition]);

  function clamp(next: { right: number; bottom: number }) {
    const maxRight = window.innerWidth - 44 - EDGE_MARGIN;
    const maxBottom = window.innerHeight - 44 - EDGE_MARGIN;
    return {
      right: Math.min(Math.max(next.right, EDGE_MARGIN), Math.max(maxRight, EDGE_MARGIN)),
      bottom: Math.min(Math.max(next.bottom, EDGE_MARGIN), Math.max(maxBottom, EDGE_MARGIN)),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRight: position.right,
      startBottom: position.bottom,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    setDragging(true);
    setPosition(
      clamp({ right: drag.startRight - dx, bottom: drag.startBottom - dy }),
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved) {
      setTourButtonPosition(position);
    }
    dragState.current = null;
    setDragging(false);
  }

  if (active || hidden) return null;

  return (
    <>
      <div
        className={cn(
          "group fixed z-[55] hidden flex-col items-center gap-2 lg:flex",
          dragging && "transition-none select-none",
        )}
        style={{ right: position.right, bottom: position.bottom }}
        data-tour="help-menu"
      >
        <button
          type="button"
          onClick={() => setHideTourButton(true)}
          aria-label={t("hide")}
          title={t("hide")}
          className={cn(
            "flex size-6 scale-90 items-center justify-center self-end rounded-full border bg-background text-muted-foreground opacity-0 shadow-lg transition-all duration-150",
            "hover:text-foreground group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100",
            "translate-y-2",
          )}
        >
          <X className="size-3.5" />
        </button>
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
          title={t("helpMenuDragHint")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "flex size-11 touch-none items-center justify-center rounded-full border bg-background text-muted-foreground shadow-lg transition-colors hover:text-foreground",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <HelpCircle className="size-5" />
        </button>
      </div>

      <CheatSheetModal open={cheatSheetOpen} onOpenChange={setCheatSheetOpen} />
    </>
  );
}
