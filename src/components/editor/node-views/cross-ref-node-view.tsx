"use client";

import { useTranslations } from "next-intl";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { FileImage, Hash, LinkIcon, Sigma, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrossRefKind } from "@/lib/tiptap/cross-ref";

const KIND_ICON: Record<CrossRefKind, typeof FileImage> = {
  figure: FileImage,
  figureSub: FileImage,
  table: Table2,
  equation: Sigma,
  heading: Hash,
  // A crossRef node can never actually resolve to "question" in practice
  // (questionBlank, not crossRef, references questions) — present purely
  // so this dictionary stays exhaustive over CrossRefKind.
  question: Hash,
};

// Clicking a reference scrolls its TARGET into view — the inverse of
// footnote references' own click-to-jump (tiptap-footnotes' own
// footnoteRefClick plugin), reimplemented here rather than shared since
// that plugin is scoped to footnote's own node type. Finds the target by
// scanning the doc for a node whose `id` attr matches, since a crossRef
// only stores the id, not a live position (positions shift on every edit;
// the id is the only stable thing to search by).
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

export function CrossRefNodeView({ node, editor }: NodeViewProps) {
  const t = useTranslations("editor.crossRef");
  const targetId = typeof node.attrs.targetId === "string" ? node.attrs.targetId : null;
  const kind = node.attrs.resolvedKind as CrossRefKind | null;
  const value = typeof node.attrs.resolvedValue === "string" ? node.attrs.resolvedValue : null;
  const broken = Boolean(node.attrs.broken);

  // Equation's resolvedValue is always the plain sequence number (see
  // cross-ref.ts's resolver) — a refName is only a readable label in the @
  // suggestion list, never a substitute for "式 (N)" here.
  const label = broken
    ? t("broken")
    : kind === "heading"
      ? (value ?? "")
      : kind
        ? t(`labels.${kind}`, { number: value ?? "" })
        : "";

  const Icon = kind ? KIND_ICON[kind] : LinkIcon;

  return (
    <NodeViewWrapper as="span" className="inline-flex align-baseline">
      <button
        type="button"
        contentEditable={false}
        title={broken ? t("brokenHint") : undefined}
        onClick={() => targetId && !broken && jumpToTarget(editor, targetId)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm transition-colors",
          broken
            ? "border border-dashed border-destructive/50 text-destructive"
            : "bg-accent/60 text-foreground hover:bg-accent",
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="max-w-48 truncate">{label}</span>
      </button>
    </NodeViewWrapper>
  );
}
