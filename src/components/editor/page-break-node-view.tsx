"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function PageBreakNodeView({
  node,
  deleteNode,
  selected,
}: NodeViewProps) {
  const t = useTranslations("editor.toolbar");
  const command =
    node.attrs.weak === true ? "#pagebreak(weak: true)" : "#pagebreak()";

  return (
    <NodeViewWrapper
      as="div"
      data-type="page-break"
      data-weak={node.attrs.weak === true ? "true" : "false"}
      className={`anvil-page-break${selected ? " is-selected" : ""}`}
      contentEditable={false}
    >
      <div
        className="anvil-page-break__line"
        role="separator"
        aria-label={command}
      />
      <button
        type="button"
        className="anvil-page-break__delete"
        aria-label={t("pageBreakDelete")}
        title={t("pageBreakDelete")}
        contentEditable={false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.stopPropagation();
          deleteNode();
        }}
      >
        <Trash2 aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </NodeViewWrapper>
  );
}
