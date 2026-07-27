"use client";

import type { Editor } from "@tiptap/core";
import { TextWrap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { insertPageBreak } from "@/lib/tiptap/page-break";
import { useFeatureMenuReveal } from "@/lib/features/use-feature-menu-reveal";

export function PageBreakMenu({
  editor,
  labels,
}: {
  editor: Editor;
  labels: {
    trigger: string;
    forced: string;
    forcedHint: string;
    weak: string;
    weakHint: string;
  };
}) {
  const { open, setOpen } = useFeatureMenuReveal("editor.pageBreak");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={labels.trigger}
          aria-label={labels.trigger}
          data-feature-id="editor.pageBreak"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:size-8"
        >
          <TextWrap className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem
          data-feature-id="editor.pageBreak.forced"
          className="flex flex-col items-start gap-0.5"
          onSelect={() => insertPageBreak(editor, false)}
        >
          <span>{labels.forced}</span>
          <span className="text-xs text-muted-foreground">
            {labels.forcedHint}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-feature-id="editor.pageBreak.smart"
          className="flex flex-col items-start gap-0.5"
          onSelect={() => insertPageBreak(editor, true)}
        >
          <span>{labels.weak}</span>
          <span className="text-xs text-muted-foreground">
            {labels.weakHint}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
