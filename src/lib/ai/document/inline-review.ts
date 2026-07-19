import type { Editor, JSONContent } from "@tiptap/core";

const SUPPORTED_INLINE_MARKS = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
]);

/**
 * Inline review never represents a structural rewrite. A model proposal must
 * be one paragraph/heading made exclusively of text and hard breaks, so it
 * can replace the original range without changing its surrounding block.
 */
export function inlineReviewContent(fragment: JSONContent[]): JSONContent[] | null {
  if (fragment.length !== 1) return null;
  const [block] = fragment;
  if (block.type !== "paragraph" && block.type !== "heading") return null;
  const content = block.content ?? [];
  if (!content.every((node) => node.type === "text" || node.type === "hardBreak")) {
    return null;
  }
  return structuredClone(content);
}

export function inlineReviewText(content: JSONContent[]): string {
  return content.map((node) => node.type === "hardBreak" ? "\n" : node.text ?? "").join("");
}

/**
 * A decoration is anchored to an exact selection, not merely a document
 * revision. Once the person moves elsewhere, the visual proposal must leave
 * with it rather than becoming an unreachable or ambiguous pending change.
 */
export function isInlineReviewRangeActive(
  range: { from: number; to: number },
  selection: { from: number; to: number },
): boolean {
  return range.from === selection.from && range.to === selection.to;
}

/**
 * The floating inline composer only applies to text that existing Tiptap
 * marks can decorate. Multi-block, node and unsupported-mark selections use
 * the right-side document-draft flow instead.
 */
export function isPlainTextSelection(editor: Editor, from: number, to: number): boolean {
  if (from < 0 || to <= from || to > editor.state.doc.content.size) return false;
  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);
  if ($from.parent !== $to.parent || !$from.parent.isTextblock) return false;

  let valid = true;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (!node.isInline) return true;
    if (node.isText) {
      if (node.marks.some((mark) => !SUPPORTED_INLINE_MARKS.has(mark.type.name))) {
        valid = false;
      }
    } else if (node.type.name !== "hardBreak") {
      valid = false;
    }
    return valid;
  });
  return valid;
}

/**
 * Browser drags that cover a complete paragraph can include the two adjacent
 * ProseMirror structure positions even though no neighbouring text is visibly
 * selected. Trim only those non-textblock boundary positions; never trim text
 * or unsupported inline content merely to make a selection pass validation.
 */
export function resolvePlainTextSelectionRange(
  editor: Editor,
  from: number,
  to: number,
): { from: number; to: number } | null {
  if (isPlainTextSelection(editor, from, to)) return { from, to };
  if (from < 0 || to <= from || to > editor.state.doc.content.size) return null;

  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);
  const normalizedFrom = $from.parent.isTextblock ? from : from + 1;
  const normalizedTo = $to.parent.isTextblock ? to : to - 1;
  return isPlainTextSelection(editor, normalizedFrom, normalizedTo)
    ? { from: normalizedFrom, to: normalizedTo }
    : null;
}
