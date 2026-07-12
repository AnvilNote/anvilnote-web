"use client";

import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DividerLineStyle } from "@/lib/tiptap/divider";

const LINE_STYLES: DividerLineStyle[] = ["solid", "dashed", "dotted", "dashdot"];

// Mirrors divider.ts's CSS_BORDER_STYLE approximation (no native CSS
// dash-dot border-style) — used only for this tiny style-picker preview.
const CSS_BORDER_STYLE: Record<DividerLineStyle, string> = {
  solid: "solid",
  dashed: "dashed",
  dotted: "dotted",
  dashdot: "dashed",
};

// A NodeSelection around the divider is the only way it's ever selected
// (it's a leaf node — no content to place a cursor inside), so
// shouldShow just needs to confirm that's the current selection kind AND
// the selected node is a horizontalRule, rather than the text-mark-based
// `from !== to` gate TiptapBubbleMenu uses for its own selection.
export function DividerBubbleMenu({ editor }: { editor: Editor }) {
  const t = useTranslations("editor.block");
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { selection } = e.state;
      const isDivider =
        selection instanceof NodeSelection && selection.node.type.name === "horizontalRule";
      return {
        isDivider,
        thicknessPt: isDivider ? (selection.node.attrs.thicknessPt as number) : 0.5,
        lineStyle: isDivider
          ? (selection.node.attrs.lineStyle as DividerLineStyle)
          : "solid",
      };
    },
  });

  const updateAttrs = (attrs: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes("horizontalRule", attrs).run();

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-2 rounded-lg border bg-popover p-1.5 shadow-md"
      shouldShow={() => s.isDivider}
    >
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t("dividerThickness")}
        <input
          type="number"
          min={0.25}
          max={12}
          step={0.25}
          value={s.thicknessPt}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value > 0) {
              updateAttrs({ thicknessPt: value });
            }
          }}
          className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs"
        />
        pt
      </label>
      <span className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        {LINE_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            title={t(`dividerStyles.${style}`)}
            aria-label={t(`dividerStyles.${style}`)}
            aria-pressed={s.lineStyle === style}
            onClick={() => updateAttrs({ lineStyle: style })}
            className={cn(
              "flex h-7 w-9 items-center justify-center rounded transition-colors hover:bg-accent",
              s.lineStyle === style && "bg-accent",
            )}
          >
            <span
              className="w-6 border-t-2"
              style={{ borderTopStyle: CSS_BORDER_STYLE[style] as never }}
            />
          </button>
        ))}
      </div>
    </BubbleMenu>
  );
}
