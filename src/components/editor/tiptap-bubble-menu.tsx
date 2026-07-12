"use client";

import type { ComponentType } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { Bold, Code, Italic, Link2, Sigma, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MathClickMode } from "@/lib/tiptap/extensions";

function MenuButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

export function TiptapBubbleMenu({
  editor,
  onInsertMath,
  onEditLink,
  onEditColor,
}: {
  editor: Editor;
  onInsertMath: (mode: MathClickMode) => void;
  onEditLink: () => void;
  onEditColor: () => void;
}) {
  const t = useTranslations("editor.toolbar");
  const tBlock = useTranslations("editor.block");
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      color: e.getAttributes("textStyle").color as string | undefined,
    }),
  });

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
      shouldShow={({ editor: e, from, to }) =>
        from !== to &&
        !(e.state.selection instanceof CellSelection) &&
        !e.isActive("codeBlock") &&
        !e.isActive("blockMath") &&
        !e.isActive("horizontalRule")
      }
    >
      <MenuButton
        icon={Bold}
        label={t("bold")}
        active={s.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <MenuButton
        icon={Italic}
        label={t("italic")}
        active={s.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <MenuButton
        icon={Strikethrough}
        label={t("strike")}
        active={s.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <MenuButton
        icon={Code}
        label={t("code")}
        active={s.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <MenuButton
        icon={Link2}
        label={t("link")}
        active={s.link}
        onClick={onEditLink}
      />
      <MenuButton
        icon={Sigma}
        label={t("inlineMath")}
        onClick={() => {
          // The bubble menu only shows while there's a real, non-empty
          // selection (its own shouldShow requires from !== to), so marking
          // text and clicking this is a request to turn exactly that text
          // into its LaTeX source directly — skip the empty-dialog
          // round-trip and convert in place. Falls back to the dialog only
          // for the edge case of a whitespace-only selection.
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, " ").trim();
          if (!text) {
            onInsertMath("inline");
            return;
          }
          editor.chain().focus().deleteSelection().insertInlineMath({ latex: text }).run();
        }}
      />
      <span className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        title={tBlock("color")}
        aria-label={tBlock("color")}
        onClick={onEditColor}
        className="inline-flex h-7 items-center gap-1.5 rounded px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span
          className="size-3.5 shrink-0 rounded-full border"
          style={{ backgroundColor: s.color ?? "#000000" }}
        />
        <span className="font-mono text-xs">{s.color ?? tBlock("colors.default")}</span>
      </button>
    </BubbleMenu>
  );
}
