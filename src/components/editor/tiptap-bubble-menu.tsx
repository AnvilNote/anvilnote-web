"use client";

import type { ComponentType } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
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
}: {
  editor: Editor;
  onInsertMath: (mode: MathClickMode) => void;
  onEditLink: () => void;
}) {
  const t = useTranslations("editor.toolbar");
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
    }),
  });

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
      shouldShow={({ editor: e, from, to }) =>
        from !== to && !e.isActive("codeBlock") && !e.isActive("blockMath")
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
        onClick={() => onInsertMath("inline")}
      />
    </BubbleMenu>
  );
}
