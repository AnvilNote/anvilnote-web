"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useTranslations } from "next-intl";
import { GripVertical } from "lucide-react";

export function BlockHandle({ editor }: { editor: Editor }) {
  const t = useTranslations("editor.block");

  // onNodeChange must stay referentially stable — DragHandle re-registers
  // its ProseMirror plugin whenever this prop's identity changes, and a
  // plugin re-registration resets every other plugin, tearing down an open
  // "/" suggestion popup. It's a no-op now that there's no per-node state
  // to track (the click-to-delete/color-change menu was removed — it fought
  // with native drag gesture detection on the same button, since Radix's
  // trigger has to react on pointerdown, before the browser can tell a
  // click apart from the start of a drag), but the empty-and-stable
  // callback is still required by the same constraint.
  const handleNodeChange = useCallback((_data: { node: PMNode | null; pos: number }) => {}, []);

  return (
    <DragHandle editor={editor} className="anvil-drag-handle" onNodeChange={handleNodeChange}>
      <div
        aria-label={t("menu")}
        className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </div>
    </DragHandle>
  );
}
