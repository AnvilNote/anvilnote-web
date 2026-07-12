"use client";

import type { ComponentType } from "react";
import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns3,
  RotateCcw,
  Rows3,
  TableCellsMerge,
  TableCellsSplit,
} from "lucide-react";
import { cn } from "@/lib/utils";

function TableMenuButton({
  icon: Icon,
  label,
  active,
  disabled,
  destructive,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  destructive?: boolean;
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
        "inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        active && "bg-accent text-foreground",
        destructive && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

export function TableBubbleMenu({ editor }: { editor: Editor }) {
  const t = useTranslations("editor.table");
  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const selection = currentEditor.state.selection;
      const isCellSelection = selection instanceof CellSelection;
      const attrs = isCellSelection ? selection.$anchorCell.nodeAfter?.attrs : undefined;
      return {
        isCellSelection,
        canMerge: isCellSelection && currentEditor.can().mergeCells(),
        canSplit: isCellSelection && currentEditor.can().splitCell(),
        align: typeof attrs?.align === "string" ? attrs.align : "left",
        fill: typeof attrs?.fill === "string" ? attrs.fill : null,
        stroke: typeof attrs?.stroke === "string" ? attrs.stroke : null,
        inset: typeof attrs?.inset === "string" ? attrs.inset : null,
        breakable: typeof attrs?.breakable === "boolean" ? attrs.breakable : null,
      };
    },
  });

  const setCellAttribute = (name: string, value: unknown) =>
    editor.chain().focus().setCellAttribute(name, value).run();
  const inset = Number.parseFloat(state.inset ?? "");

  return (
    <BubbleMenu
      editor={editor}
      className="flex max-w-[min(94vw,48rem)] items-center gap-0.5 overflow-x-auto rounded-lg border bg-popover p-1 shadow-md"
      shouldShow={() => state.isCellSelection}
    >
      <TableMenuButton
        icon={TableCellsMerge}
        label={t("mergeCells")}
        disabled={!state.canMerge}
        onClick={() => editor.chain().focus().mergeCells().run()}
      />
      <TableMenuButton
        icon={TableCellsSplit}
        label={t("splitCell")}
        disabled={!state.canSplit}
        onClick={() => editor.chain().focus().splitCell().run()}
      />
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      <TableMenuButton
        icon={Rows3}
        label={t("deleteRows")}
        destructive
        onClick={() => editor.chain().focus().deleteRow().run()}
      />
      <TableMenuButton
        icon={Columns3}
        label={t("deleteColumns")}
        destructive
        onClick={() => editor.chain().focus().deleteColumn().run()}
      />
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      {(
        [
          ["left", AlignLeft, t("alignLeft")],
          ["center", AlignCenter, t("alignCenter")],
          ["right", AlignRight, t("alignRight")],
        ] as const
      ).map(([align, Icon, label]) => (
        <TableMenuButton
          key={align}
          icon={Icon}
          label={label}
          active={state.align === align}
          onClick={() => setCellAttribute("align", align)}
        />
      ))}
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      <label className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" title={t("fill")}>
        <span>{t("fill")}</span>
        <input
          type="color"
          value={state.fill ?? "#ffffff"}
          aria-label={t("fill")}
          onChange={(event) => setCellAttribute("fill", event.target.value)}
          className="size-4 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>
      <label className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" title={t("stroke")}>
        <span>{t("stroke")}</span>
        <input
          type="color"
          value={state.stroke ?? "#d4d4d8"}
          aria-label={t("stroke")}
          onChange={(event) => setCellAttribute("stroke", event.target.value)}
          className="size-4 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>
      <label className="flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground" title={t("inset")}>
        <span>{t("inset")}</span>
        <input
          type="number"
          min={0}
          max={72}
          step={0.5}
          value={Number.isFinite(inset) ? inset : 5}
          aria-label={t("inset")}
          onChange={(event) => setCellAttribute("inset", `${Math.max(0, Number(event.target.value))}pt`)}
          className="w-12 rounded border bg-background px-1 py-0.5 text-xs"
        />
        pt
      </label>
      <label className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" title={t("breakable")}>
        {/* Round checkbox: black disc + white check icon when checked —
            see globals.css's .anvil-check-round (a native <input> can't
            hold child markup, so the check glyph is a background-image;
            keyboard/AT semantics stay intact). */}
        <input
          type="checkbox"
          checked={state.breakable ?? true}
          onChange={(event) => setCellAttribute("breakable", event.target.checked)}
          className="anvil-check-round"
        />
        {t("breakable")}
      </label>
      <TableMenuButton
        icon={RotateCcw}
        label={t("resetCellAttrs")}
        onClick={() =>
          editor
            .chain()
            .focus()
            .setCellAttribute("align", null)
            .setCellAttribute("fill", null)
            .setCellAttribute("stroke", null)
            .setCellAttribute("inset", null)
            .setCellAttribute("breakable", null)
            .run()
        }
      />
    </BubbleMenu>
  );
}
