"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, Circle, PenLine } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { QuestionKind } from "@/lib/question-kinds";

// Shared 3-entry (單選/多選/手寫) popover, opened by both the toolbar's
// insert button and question-node-view.tsx's in-block "add question"
// button — same menu, different callback (insert a whole new block vs.
// append an item to an existing one).
const KIND_OPTIONS: { kind: QuestionKind; icon: typeof Circle }[] = [
  { kind: "single", icon: Circle },
  { kind: "multi", icon: CheckSquare },
  { kind: "written", icon: PenLine },
];

export function QuestionKindMenu({
  trigger,
  onSelect,
}: {
  trigger: React.ReactNode;
  onSelect: (kind: QuestionKind) => void;
}) {
  const t = useTranslations("editor.questionBlock");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {KIND_OPTIONS.map(({ kind, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              onSelect(kind);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            <Icon className="size-3.5" />
            {t(`kinds.${kind}`)}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
