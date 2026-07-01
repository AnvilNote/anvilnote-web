"use client";

import { useTranslations } from "next-intl";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
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
// (NodeViewContent), and a borderless kind switcher pinned to the bottom-right
// corner. Switching kind only re-seeds the title while the user hasn't typed
// their own (titleTouched stays false until they edit it).
export function CalloutNodeView({ node, updateAttributes }: NodeViewProps) {
  const t = useTranslations("editor.callout");
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
      style={{
        backgroundColor: palette.background,
        borderLeftColor: palette.accent,
      }}
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
      </div>
    </NodeViewWrapper>
  );
}
