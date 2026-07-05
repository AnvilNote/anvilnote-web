"use client";

import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";

// Side-by-side image container. Content (real `image` nodes, each with its
// own full image-node-view.tsx — caption, resize, crop, zoom) renders via
// NodeViewContent; this view only owns the grid layout around them and a
// delete-the-whole-row button. Column count matches the current child
// count exactly (not a fixed 2), so a row that's grown past 2 images still
// lays out evenly.
export function ImageRowNodeView({ node, deleteNode }: NodeViewProps) {
  const tBlock = useTranslations("editor.block");
  const columns = Math.max(2, node.childCount);

  return (
    <NodeViewWrapper className="anvil-image-row" data-type="image-row">
      <div
        className="anvil-image-row__grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        <NodeViewContent className="contents" />
      </div>
      <div className="anvil-image-row__actions" contentEditable={false}>
        <button
          type="button"
          aria-label={tBlock("delete", { type: tBlock("types.imageRow") })}
          title={tBlock("delete", { type: tBlock("types.imageRow") })}
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
