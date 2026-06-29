"use client";

import type { ComponentType } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Grid2x2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Sigma,
  SquareSigma,
  Strikethrough,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pickAndInsertImage } from "@/lib/tiptap/image";
import type {
  MathClickMode,
  TableAlign,
  TableVariant,
} from "@/lib/tiptap/extensions";

function ToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors md:size-8",
        "hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border md:mx-1" />;
}

export function TiptapToolbar({
  editor,
  onInsertMath,
  onEditLink,
}: {
  editor: Editor;
  onInsertMath: (mode: MathClickMode) => void;
  onEditLink: () => void;
}) {
  const t = useTranslations("editor.toolbar");

  // Snapshot the marks/nodes relevant to the toolbar so it re-renders on every
  // selection or content change without re-rendering the editor surface.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive("paragraph"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      inTable: e.isActive("table"),
      tableVariant: (e.getAttributes("table").variant ?? "normal") as TableVariant,
      tableAlign: (e.getAttributes("table").align ?? "center") as TableAlign,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  function setTableVariant(variant: TableVariant) {
    editor.chain().focus().updateAttributes("table", { variant }).run();
  }

  function setTableAlign(align: TableAlign) {
    editor.chain().focus().updateAttributes("table", { align }).run();
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible lg:pb-0">
      <ToolbarButton
        icon={Pilcrow}
        label={t("paragraph")}
        active={s.paragraph}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
      <ToolbarButton
        icon={Heading1}
        label={t("heading1")}
        active={s.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={Heading2}
        label={t("heading2")}
        active={s.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={Heading3}
        label={t("heading3")}
        active={s.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Divider />

      <ToolbarButton
        icon={Bold}
        label={t("bold")}
        active={s.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label={t("italic")}
        active={s.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label={t("strike")}
        active={s.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        icon={Code}
        label={t("code")}
        active={s.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />

      <Divider />

      <ToolbarButton
        icon={List}
        label={t("bulletList")}
        active={s.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label={t("orderedList")}
        active={s.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      <Divider />

      <ToolbarButton
        icon={Quote}
        label={t("blockquote")}
        active={s.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={Code2}
        label={t("codeBlock")}
        active={s.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton
        icon={Link2}
        label={t("link")}
        active={s.link}
        onClick={onEditLink}
      />
      <ToolbarButton
        icon={TableIcon}
        label={t("table")}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      />
      <ToolbarButton
        icon={ImagePlus}
        label={t("image")}
        onClick={() => pickAndInsertImage(editor)}
      />

      <Divider />

      <ToolbarButton
        icon={Sigma}
        label={t("inlineMath")}
        onClick={() => onInsertMath("inline")}
      />
      <ToolbarButton
        icon={SquareSigma}
        label={t("blockMath")}
        onClick={() => onInsertMath("block")}
      />

      <Divider />

      <ToolbarButton
        icon={Undo2}
        label={t("undo")}
        disabled={!s.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label={t("redo")}
        disabled={!s.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />

      {s.inTable ? (
        <>
          <Divider />
          <ToolbarButton
            icon={Grid2x2}
            label={t("tableNormal")}
            active={s.tableVariant === "normal"}
            onClick={() => setTableVariant("normal")}
          />
          <ToolbarButton
            icon={Rows3}
            label={t("tableThreeLine")}
            active={s.tableVariant === "three-line"}
            onClick={() => setTableVariant("three-line")}
          />
          <Divider />
          <ToolbarButton
            icon={AlignLeft}
            label={t("tableAlignLeft")}
            active={s.tableAlign === "left"}
            onClick={() => setTableAlign("left")}
          />
          <ToolbarButton
            icon={AlignCenter}
            label={t("tableAlignCenter")}
            active={s.tableAlign === "center"}
            onClick={() => setTableAlign("center")}
          />
          <ToolbarButton
            icon={AlignRight}
            label={t("tableAlignRight")}
            active={s.tableAlign === "right"}
            onClick={() => setTableAlign("right")}
          />
        </>
      ) : null}
    </div>
  );
}
