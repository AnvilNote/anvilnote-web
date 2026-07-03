"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

// Pins the footnotes list to the bottom of the editor column regardless of
// scroll position, via CSS `position: fixed` — NOT by portaling contentDOM
// elsewhere. An earlier version portaled the content into a separate DOM
// subtree outside the ProseMirror root; that broke editing entirely,
// because contentEditable only inherits to real DOM descendants of the
// editable root, and a React portal only changes where a node lives in the
// React tree, not the actual DOM tree. Staying in place and just
// repositioning with CSS keeps this a genuine descendant of the editable
// root (typing, cursor placement, selection all keep working), while still
// visually detaching from the scrolling flow. The editor column's scroll
// container carries `transform-gpu` (see the document editor page) so this
// fixed element's containing block is that column, not the full viewport.
//
// The `position: fixed` styling lives on an INNER div, not on
// NodeViewWrapper itself. BlockHandle's drag-handle library reads
// `view.dom.lastElementChild.getBoundingClientRect()` (this node is always
// the document's trailing child, per the schema) to clamp where it looks
// for a hover target — a fixed-position element reports viewport-relative
// coordinates there instead of its position in the document flow, which
// silently broke drag handles for every block in the whole document, not
// just this one. Keeping NodeViewWrapper a plain in-flow box (with a
// deliberate non-zero height — a fixed child contributes nothing to a
// normal-flow parent's height, and a collapsed-to-zero box fails the
// library's own "is this a valid rect" check) gives it a normal, correctly
// positioned rect to read, while the visible/interactive panel is the fixed
// child underneath — invisible in-flow, visible via fixed positioning.
export function FootnotesNodeView() {
  const t = useTranslations("editor.footnotes");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <NodeViewWrapper style={{ display: "block", height: "1px", overflow: "hidden" }}>
      <div className="anvil-footnotes-panel">
        <button
          type="button"
          contentEditable={false}
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {t("title")}
          </span>
          <span>{collapsed ? t("expand") : t("collapse")}</span>
        </button>
        <div
          className="anvil-footnotes-panel__content"
          style={{ maxHeight: collapsed ? 0 : undefined }}
        >
          <div className="anvil-footnotes-panel__inner">
            <NodeViewContent<"ol"> as="ol" className="anvil-footnotes-panel__list footnotes" />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
