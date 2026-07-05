"use client";

import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { CaptionInput } from "@/components/editor/caption-input";

// Side-by-side image container. Content (real `image` nodes, each with its
// own full image-node-view.tsx — caption, resize, crop, zoom) renders via
// NodeViewContent; this view only owns the grid layout around them, a
// shared caption for the WHOLE row ("圖 1: 兩種方法比較", on top of each
// child's own "(a)"/"(b)" caption — explicit ask, not a replacement for
// per-child captions), and a delete-the-whole-row button. Column count
// matches the current child count exactly (not a fixed 2), so a row that's
// grown past 2 images still lays out evenly.
export function ImageRowNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.imageRow");
  const tBlock = useTranslations("editor.block");
  const tImage = useTranslations("editor.image");
  const columns = Math.max(2, node.childCount);
  const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";

  return (
    <NodeViewWrapper className="anvil-image-row" data-type="image-row">
      <div
        className="anvil-image-row__grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        <NodeViewContent className="contents" />
      </div>
      <div className="anvil-image-row__caption" contentEditable={false}>
        <span className="anvil-image-row__caption-label" data-label={tImage("figure")} />
        <CaptionInput
          value={caption}
          placeholder={t("captionPlaceholder")}
          onChange={(value) => updateAttributes({ caption: value })}
          className="anvil-caption-input"
        />
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
