"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useTranslations } from "next-intl";
import { GripVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// A small, restrained palette. "default" clears the color (back to foreground).
const COLORS: { key: string; value: string | null }[] = [
  { key: "default", value: null },
  { key: "gray", value: "#6b7280" },
  { key: "red", value: "#dc2626" },
  { key: "orange", value: "#ea580c" },
  { key: "green", value: "#16a34a" },
  { key: "blue", value: "#2563eb" },
  { key: "purple", value: "#7c3aed" },
];

// Color is only offered for plain text blocks.
const TEXT_BLOCKS = new Set(["paragraph", "heading"]);

// Map a node to an i18n key under editor.block.types, so the delete action can
// name what it removes ("Delete table", "Delete heading 2", …).
function blockTypeKey(node: PMNode | null): string {
  if (!node) return "block";
  const name = node.type.name;
  if (name === "heading") {
    const level = node.attrs?.level;
    if (level === 1) return "heading1";
    if (level === 3) return "heading3";
    return "heading2";
  }
  switch (name) {
    case "paragraph":
      return "paragraph";
    case "bulletList":
      return "bulletList";
    case "orderedList":
      return "orderedList";
    case "blockquote":
      return "blockquote";
    case "codeBlock":
      return "codeBlock";
    case "image":
      return "image";
    case "table":
      return "table";
    case "blockMath":
      return "blockMath";
    case "horizontalRule":
      return "divider";
    default:
      return "block";
  }
}

export function BlockHandle({ editor }: { editor: Editor }) {
  const t = useTranslations("editor.block");
  const [node, setNode] = useState<PMNode | null>(null);
  const [pos, setPos] = useState(-1);
  const [open, setOpen] = useState(false);

  const isTextBlock = node ? TEXT_BLOCKS.has(node.type.name) : false;
  const blockName = t(`types.${blockTypeKey(node)}` as never);

  function deleteBlock() {
    if (pos < 0) return;
    editor.chain().focus().setNodeSelection(pos).deleteSelection().run();
    setOpen(false);
  }

  function applyColor(value: string | null) {
    if (pos < 0 || !node) return;
    const from = pos + 1;
    const to = pos + node.nodeSize - 1;
    const chain = editor.chain().focus().setTextSelection({ from, to });
    if (value) chain.setColor(value);
    else chain.unsetColor();
    chain.run();
    setOpen(false);
  }

  return (
    <DragHandle
      editor={editor}
      className="anvil-drag-handle"
      onNodeChange={(data) => {
        // Freeze the target while the menu is open so moving the mouse onto the
        // menu doesn't retarget delete/color to a different block.
        if (open) return;
        setNode(data.node);
        setPos(data.pos);
      }}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("menu")}
            className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-44">
          <DropdownMenuItem
            onSelect={deleteBlock}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            {t("delete", { type: blockName })}
          </DropdownMenuItem>
          {isTextBlock ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t("color")}
              </DropdownMenuLabel>
              <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
                {COLORS.map((c) => {
                  const label = t(`colors.${c.key}` as never);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      title={label}
                      aria-label={label}
                      onClick={() => applyColor(c.value)}
                      className={cn(
                        "size-5 rounded-full border transition-transform hover:scale-110",
                        c.value ? "" : "bg-background",
                      )}
                      style={c.value ? { backgroundColor: c.value } : undefined}
                    />
                  );
                })}
              </div>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </DragHandle>
  );
}
