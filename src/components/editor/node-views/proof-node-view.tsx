"use client";

import { useTranslations } from "next-intl";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Trash2 } from "lucide-react";

// React NodeView for the proof block: a fixed "證明"/"Proof" header (never
// user-editable — see proof.ts's doc comment on why this differs from
// callout's kind+title), the paragraph body (NodeViewContent), a solid QED
// square pinned bottom-right, and a delete button next to it — same
// corner/pattern as callout's own delete button (see callout-node-view.tsx's
// comment on why a plain onClick button, not layered on the shared drag
// handle, is used).
export function ProofNodeView({ deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.proof");
  const tBlock = useTranslations("editor.block");

  return (
    <NodeViewWrapper className="anvil-proof" data-type="proof">
      <div className="anvil-proof__header" contentEditable={false}>
        {t("label")}
      </div>

      <NodeViewContent className="anvil-proof__content" />

      <div className="anvil-proof__footer" contentEditable={false}>
        <span className="anvil-proof__qed" aria-hidden="true" />
        <button
          type="button"
          aria-label={tBlock("delete", { type: tBlock("types.proof") })}
          title={tBlock("delete", { type: tBlock("types.proof") })}
          onClick={deleteNode}
          onMouseDown={(event) => event.stopPropagation()}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
