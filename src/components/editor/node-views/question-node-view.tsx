"use client";

import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";
import { QuestionKindMenu } from "@/components/editor/question-kind-menu";
import { appendQuestionItem } from "@/lib/tiptap/question";
import type { QuestionKind } from "@/lib/question-kinds";

// Container NodeView: pure chrome around its questionItem children
// (rendered by NodeViewContent, standard ProseMirror child rendering —
// each item's own NodeView, question-item-node-view.tsx, handles its own
// number/body/choices/written-area). Top-right delete removes the WHOLE
// block (all items) — this is the corrected position; v1 had it top-left,
// moved per live screenshot feedback. Bottom "add question" button opens
// the same kind menu the toolbar uses, appending a new item to this
// block.
export function QuestionNodeView({ deleteNode, editor, getPos }: NodeViewProps) {
  const tBlock = useTranslations("editor.block");
  const tq = useTranslations("editor.questionBlock");

  function handleAdd(kind: QuestionKind) {
    const pos = getPos();
    if (pos === undefined) return;
    appendQuestionItem(editor, pos, kind);
  }

  return (
    <NodeViewWrapper className="anvil-question group relative my-3 rounded border p-3" data-type="question">
      <div
        className="absolute top-1 right-1 hidden group-hover:flex"
        contentEditable={false}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={tBlock("delete", { type: tBlock("types.question") })}
          title={tBlock("delete", { type: tBlock("types.question") })}
          onClick={deleteNode}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* flex+gap targets [data-node-view-content-react], NOT this div
          itself — Tiptap's React NodeViewContent renders an extra
          unstyled wrapper div (that stable data-attribute) between its
          own contentDOM and the actual questionItem children, so gap-*
          on the outer div has only ONE flex child (that wrapper) and no
          visible effect — same wrapper that tripped up the number/body
          alignment fix earlier (see question-item-node-view.tsx's own
          comment on that). Each questionItem's own py-* was removed so
          this gap is the single source of inter-item spacing, not
          stacked with per-item padding. */}
      <NodeViewContent className="[&>[data-node-view-content-react]]:flex [&>[data-node-view-content-react]]:flex-col [&>[data-node-view-content-react]]:gap-[1em]" />

      <div className="mt-2" contentEditable={false} onMouseDown={(event) => event.stopPropagation()}>
        <QuestionKindMenu
          onSelect={handleAdd}
          trigger={
            <button
              type="button"
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              <Plus className="size-3.5" />
              {tq("addQuestion")}
            </button>
          }
        />
      </div>
    </NodeViewWrapper>
  );
}
