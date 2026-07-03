"use client";

import type { CSSProperties } from "react";
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
import { CALLOUT_KINDS, calloutPalette, normalizeCalloutKind } from "@/config/callouts";

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
  const kind = normalizeCalloutKind(node.attrs.kind as string | undefined);
  const title = typeof node.attrs.title === "string" ? node.attrs.title : "";
  const titleTouched = Boolean(node.attrs.titleTouched);
  const palette = calloutPalette(kind);

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
          "--callout-bg-light": palette.background,
          "--callout-bg-dark": palette.darkBackground,
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
