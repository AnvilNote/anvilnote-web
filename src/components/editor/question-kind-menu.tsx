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
      <PopoverContent
        className="w-40 p-1"
        align="start"
        // Real bug, caught via automated typing right after picking a
        // kind: Radix restores DOM focus to the popover's OWN trigger
        // button on close by default, which races against (and wins
        // over) the editor.chain().focus() call `onSelect`'s callback
        // (insertQuestion/appendQuestionItem/handleKindChange) already
        // makes — so focus silently lands back on this trigger button,
        // not the editor. If the very next keystroke is Space or Enter,
        // a focused <button> treats that as a native click, silently
        // reopening this same popover; a second Space/Enter then
        // re-triggers onSelect AGAIN at whatever position the editor's
        // (still-unmoved) ProseMirror selection was left at — which
        // silently nests a second question block inside the first
        // item's body. Reproduced live: typing "Which are true?"
        // right after inserting a multi-choice block produced exactly
        // this nested corruption at the second space character.
        // preventDefault() here stops Radix's own restore so the
        // onSelect callback's own .focus() call is the one that sticks.
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
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
