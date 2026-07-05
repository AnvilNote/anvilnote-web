"use client";

import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { CaptionInput } from "@/components/editor/caption-input";

// Side-by-side image container. Content (real `image` nodes, each with its
// own full image-node-view.tsx — caption, resize, crop, zoom) renders via
// NodeViewContent; this view only owns the grid layout around them, a
// shared caption for the WHOLE row ("圖 1: 兩種方法比較", on top of each
// child's own "(a)"/"(b)" caption — explicit ask, not a replacement for
// per-child captions), a delete-the-whole-row button, and a swap button
// between each adjacent pair of images. Column count matches the current
// child count exactly (not a fixed 2), so a row that's grown past 2 images
// still lays out evenly.
//
// The swap buttons live in a separate absolutely-positioned overlay, not
// inside the grid itself: NodeViewContent only ever renders the actual
// ProseMirror child (image) nodes — there's no way to interleave a
// non-node React button between them in that same flow. Each button's
// left offset is instead computed as a percentage matching the grid's own
// column boundaries ((i+1)/columns), landing it right on the gap between
// image i and image i+1 regardless of the row's actual pixel width.
function swapImages(
  editor: NodeViewProps["editor"],
  getPos: NodeViewProps["getPos"],
  node: NodeViewProps["node"],
  indexA: number,
  indexB: number,
) {
  const pos = getPos();
  if (typeof pos !== "number") return;
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => children.push(child));
  if (indexA < 0 || indexB >= children.length) return;
  const reordered = [...children];
  [reordered[indexA], reordered[indexB]] = [reordered[indexB], reordered[indexA]];
  const newNode = node.type.create(node.attrs, reordered, node.marks);
  const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, newNode);
  editor.view.dispatch(tr);
}

export function ImageRowNodeView({ node, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) {
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
        <div className="anvil-image-row__swap-overlay" contentEditable={false}>
          {Array.from({ length: node.childCount - 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("swap")}
              title={t("swap")}
              onClick={() => swapImages(editor, getPos, node, i, i + 1)}
              onMouseDown={(event) => event.stopPropagation()}
              className="anvil-image-row__swap"
              style={{ left: `${((i + 1) / columns) * 100}%` }}
            >
              <ArrowLeftRight className="size-3.5" />
            </button>
          ))}
        </div>
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
