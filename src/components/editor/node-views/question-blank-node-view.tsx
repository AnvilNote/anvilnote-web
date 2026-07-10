"use client";

import { useTranslations } from "next-intl";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { cn } from "@/lib/utils";

// Finds the target questionItem by scanning for a matching `id` attr —
// same approach cross-ref-node-view.tsx's jumpToTarget uses, for the same
// reason (only the id is stable; positions shift on every edit).
function jumpToTarget(editor: NodeViewProps["editor"], targetId: string) {
  let targetPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    if (node.attrs.id === targetId) {
      targetPos = pos;
      return false;
    }
    return true;
  });
  if (targetPos === null) return;
  const dom = editor.view.nodeDOM(targetPos);
  if (dom instanceof HTMLElement) {
    dom.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export function QuestionBlankNodeView({ node, editor }: NodeViewProps) {
  const t = useTranslations("editor.questionBlank");
  const targetId = typeof node.attrs.targetId === "string" ? node.attrs.targetId : null;
  const value = typeof node.attrs.resolvedValue === "string" ? node.attrs.resolvedValue : null;
  const broken = Boolean(node.attrs.broken);

  // 1.2em inset for a single-digit number, 1em once it reaches two digits
  // (>= 10) — symmetric, same value both sides. Matches the reference
  // template's qblank(n), which used a fixed 1em both sides; this
  // replaces that with the digit-scaled rule per explicit feedback.
  const insetEm = value && value.length >= 2 ? 1 : 1.2;

  return (
    <NodeViewWrapper as="span" className="inline-flex align-baseline">
      <button
        type="button"
        contentEditable={false}
        title={broken ? t("brokenHint") : undefined}
        onClick={() => targetId && !broken && jumpToTarget(editor, targetId)}
        style={{ paddingLeft: `${insetEm}em`, paddingRight: `${insetEm}em` }}
        className={cn(
          "inline-flex items-baseline py-0.5 text-sm",
          broken
            ? "border-b border-dashed border-destructive/50 text-destructive"
            : "border-b border-foreground/60 text-foreground hover:border-foreground",
        )}
      >
        {broken ? t("broken") : (value ?? "")}
      </button>
    </NodeViewWrapper>
  );
}
