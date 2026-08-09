"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import { CALLOUT_KINDS, calloutPalette, normalizeCalloutKind } from "@/config/callouts";

function rgbaToHex(rgba: number[]): string {
  const [r, g, b] = rgba as [number, number, number, number];
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

// React NodeView for callouts: a colored box (accent left border + tinted
// background from the kind's palette), an editable title, the paragraph body
// (NodeViewContent), a borderless kind switcher, and a delete button, both
// pinned to the bottom-right corner. Switching kind only re-seeds the title
// while the user hasn't typed their own (titleTouched stays false until
// they edit it).
//
// The delete button exists because callout sets `isolating: true` (blocks
// merging content across its boundary — needed so pressing Enter at the end
// of the last paragraph doesn't accidentally splice the next block's
// content into the callout). That same isolation means the normal
// "Backspace at the start of the block right after this one" gesture,
// which deletes/merges most other block types, does nothing here by
// design — a callout was never deletable that way, only via an explicit
// affordance. A plain onClick button (not layered on the shared drag
// handle) has none of the pointerdown-vs-drag-gesture conflict that a
// dropdown trigger there ran into (see block-handle.tsx's history).
export function CalloutNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.callout");
  const tBlock = useTranslations("editor.block");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const kind = normalizeCalloutKind(node.attrs.kind as string | undefined);
  const title = typeof node.attrs.title === "string" ? node.attrs.title : "";
  const titleTouched = Boolean(node.attrs.titleTouched);
  const customBackground = typeof node.attrs.customBackground === "string" ? node.attrs.customBackground : null;
  const palette = calloutPalette(kind);
  const backgroundLight = customBackground || palette.background;
  const backgroundDark = customBackground || palette.darkBackground;

  function setKind(nextKind: string) {
    const normalized = normalizeCalloutKind(nextKind);
    updateAttributes({
      kind: normalized,
      ...(titleTouched ? {} : { title: t(`kinds.${normalized}` as never) }),
    });
  }

  function setTitle(value: string) {
    updateAttributes({ title: value, titleTouched: true });
  }

  function setCustomBackground(hex: string | null) {
    updateAttributes({ customBackground: hex });
  }

  return (
    <NodeViewWrapper
      className="anvil-callout"
      data-kind={kind}
      // Both background variants are fixed hex from the palette (see
      // callouts.ts's comment on why — a runtime color-mix() formula here
      // measured correctly in a regular browser but rendered visibly wrong,
      // uniformly yellow-green, inside the packaged Electron app). The CSS
      // .dark selector below picks between them — this component doesn't
      // need to know the current theme itself.
      style={
        {
          "--callout-bg-light": backgroundLight,
          "--callout-bg-dark": backgroundDark,
          borderLeftColor: palette.accent,
        } as CSSProperties
      }
    >
      <input
        type="text"
        value={title}
        placeholder={t(`kinds.${kind}` as never)}
        onChange={(event) => setTitle(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        className="anvil-callout__title"
        style={{ color: palette.accent }}
      />

      <NodeViewContent className="anvil-callout__content" />

      <div className="anvil-callout__kind-picker" contentEditable={false}>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger
            size="sm"
            aria-label={t("selectKind")}
            onMouseDown={(event) => event.stopPropagation()}
            className="h-6 gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 data-[state=open]:text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="max-h-72">
            {CALLOUT_KINDS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id} className="text-xs">
                {t(`kinds.${entry.id}` as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover onOpenChange={setColorPickerOpen} open={colorPickerOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label={t("customBackground")}
              className="flex size-6 items-center justify-center rounded"
              onMouseDown={(event) => event.stopPropagation()}
              title={t("customBackground")}
              type="button"
            >
              <span
                className="size-3.5 rounded-full border"
                style={{ backgroundColor: backgroundLight }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 rounded-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <ColorPicker
              className="gap-3"
              onChange={(rgba) => setCustomBackground(rgbaToHex(rgba as number[]))}
              value={backgroundLight}
            >
              <ColorPickerSelection className="h-32" />
              <ColorPickerHue />
              <div className="flex items-center gap-2">
                <ColorPickerEyeDropper />
                <ColorPickerOutput />
              </div>
              <ColorPickerFormat />
            </ColorPicker>
            {customBackground ? (
              <button
                className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCustomBackground(null)}
                type="button"
              >
                {t("resetBackground")}
              </button>
            ) : null}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          aria-label={tBlock("delete", { type: tBlock("types.callout") })}
          title={tBlock("delete", { type: tBlock("types.callout") })}
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
