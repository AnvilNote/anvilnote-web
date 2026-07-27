"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useTranslations } from "next-intl";
import { GripVertical } from "lucide-react";

const LIST_ITEM_NODE_TYPES = new Set(["listItem", "taskItem"]);

// The handle's left offset for a list item has to clear whatever the
// item's own marker renders as ("1." vs "(1)" vs "viii." vs "①" are all
// very different widths) — a single fixed CSS transform (the old
// -1rem) only looks right for the narrow end of that range and visibly
// overlaps wider markers. Measured via a shared offscreen canvas using
// the list item's own computed font, so it tracks whatever font/size the
// theme actually renders with instead of hardcoding one.
const MIN_LIST_HANDLE_OFFSET_PX = 16; // matches the old fixed -1rem baseline
const LIST_HANDLE_GAP_PX = 6; // breathing room between marker and handle

let measureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext;
  measureContext =
    typeof document === "undefined"
      ? null
      : (document.createElement("canvas").getContext("2d") ?? null);
  return measureContext;
}

function measureListMarkerOffsetPx(li: HTMLElement): number {
  const marker = li.getAttribute("data-list-marker");
  if (!marker) return MIN_LIST_HANDLE_OFFSET_PX;
  const ctx = getMeasureContext();
  if (!ctx) return MIN_LIST_HANDLE_OFFSET_PX;
  const style = getComputedStyle(li);
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  // The actual rendered marker includes a trailing space (see globals.css's
  // `content: attr(data-list-marker) " "`).
  const width = ctx.measureText(`${marker} `).width;
  return Math.max(MIN_LIST_HANDLE_OFFSET_PX, Math.round(width) + LIST_HANDLE_GAP_PX);
}

export function BlockHandle({ editor }: { editor: Editor }) {
  const t = useTranslations("editor.block");
  const [isListItem, setIsListItem] = useState(false);

  // onNodeChange must stay referentially stable — DragHandle re-registers
  // its ProseMirror plugin whenever this prop's identity changes, and a
  // plugin re-registration resets every other plugin, tearing down an open
  // "/" suggestion popup. State is limited to the list-specific horizontal
  // offset; the callback identity itself never changes.
  const handleNodeChange = useCallback(
    ({ node, pos }: { node: PMNode | null; pos: number }) => {
      const nextIsListItem =
        node !== null && LIST_ITEM_NODE_TYPES.has(node.type.name);
      setIsListItem((current) =>
        current === nextIsListItem ? current : nextIsListItem,
      );

      // The custom property is set on the handle's own mount point
      // (editor.view.dom's parent — see @tiptap/extension-drag-handle's
      // drag-handle-plugin.ts: `editor.view.dom.parentElement.appendChild
      // (wrapper)`), which is a real DOM ancestor of the handle regardless
      // of this component's own React tree, so it inherits down correctly.
      const container = editor.view?.dom.parentElement;
      if (!container) return;
      if (!nextIsListItem) return;
      const li = editor.view?.nodeDOM(pos);
      if (!(li instanceof HTMLElement)) return;
      container.style.setProperty(
        "--anvil-drag-handle-list-offset",
        `-${measureListMarkerOffsetPx(li)}px`,
      );
    },
    [editor],
  );

  return (
    <DragHandle
      editor={editor}
      className={`anvil-drag-handle${isListItem ? " anvil-drag-handle--list" : ""}`}
      onNodeChange={handleNodeChange}
      // nested.enabled: true — NOT the extension's own default. Read the
      // extension's source directly to settle this (two contradictory doc
      // comments had accumulated here across earlier sessions): with
      // nested disabled (the default), coordinate lookup goes through
      // findClosestTopLevelBlock, which unconditionally walks UP the DOM
      // to the nearest direct child of the ProseMirror root — there is no
      // code path there that can ever resolve to a node nested inside
      // another block like callout's paragraphs. Confirmed by testing:
      // hovering a callout's inner paragraph and dragging still moved the
      // whole callout. nested:true switches to findBestDragTarget instead,
      // which scores EVERY ancestor at the cursor position and, on a tie
      // (defaultRules don't deduct anything from a plain paragraph or from
      // callout), breaks it by depth — the deeper node wins. That means a
      // callout's inner paragraph (deeper) naturally outscores the callout
      // itself with no custom rules needed.
      //
      // edgeDetection: "none" — the extension's own default ("left") adds
      // a `strength(500) * depth` score deduction whenever the cursor is
      // within 12px of a candidate's own left edge, specifically so
      // hovering near a nested block's edge prefers its shallower parent
      // instead. That deduction always fully excludes anything at depth
      // >= 2 (500*2 = 1000 = the entire base score) while depth-1 items
      // only lose half their score and stay eligible — so nested list
      // items (which sit deeper with every level of indent) become
      // effectively impossible to grab near their own edge, while
      // top-level items feel fine. We have no use for "prefer the parent
      // near an edge" at all here (nothing asked for it), so disabling it
      // entirely makes the deepest node under the cursor always win, at
      // any nesting depth, matching what "hover directly over an item"
      // intuitively means.
      nested={{ edgeDetection: "none" }}
    >
      <div
        aria-label={t("menu")}
        className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </div>
    </DragHandle>
  );
}
