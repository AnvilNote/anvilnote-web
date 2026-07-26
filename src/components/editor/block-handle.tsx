"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useTranslations } from "next-intl";
import { GripVertical } from "lucide-react";

const LIST_ITEM_NODE_TYPES = new Set(["listItem", "taskItem"]);

export function BlockHandle({ editor }: { editor: Editor }) {
  const t = useTranslations("editor.block");
  const [isListItem, setIsListItem] = useState(false);

  // onNodeChange must stay referentially stable — DragHandle re-registers
  // its ProseMirror plugin whenever this prop's identity changes, and a
  // plugin re-registration resets every other plugin, tearing down an open
  // "/" suggestion popup. State is limited to the list-specific horizontal
  // offset; the callback identity itself never changes.
  const handleNodeChange = useCallback(
    ({ node }: { node: PMNode | null; pos: number }) => {
      const nextIsListItem =
        node !== null && LIST_ITEM_NODE_TYPES.has(node.type.name);
      setIsListItem((current) =>
        current === nextIsListItem ? current : nextIsListItem,
      );
    },
    [],
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
      nested={true}
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
