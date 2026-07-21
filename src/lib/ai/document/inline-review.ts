import type { Editor, JSONContent } from "@tiptap/core";

const SUPPORTED_INLINE_MARKS = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
]);

function isReviewableBlock(block: JSONContent): boolean {
  if (block.type !== "paragraph" && block.type !== "heading") return false;
  const content = block.content ?? [];
  return content.every((node) => node.type === "text" || node.type === "hardBreak");
}

/**
 * Inline review never represents a structural rewrite. A model proposal must
 * be one paragraph/heading made exclusively of text and hard breaks, so it
 * can replace the original range without changing its surrounding block.
 */
export function inlineReviewContent(fragment: JSONContent[]): JSONContent[] | null {
  if (fragment.length !== 1) return null;
  const [block] = fragment;
  if (!isReviewableBlock(block)) return null;
  return structuredClone(block.content ?? []);
}

/**
 * A selection covering an entire block (see isWholeBlockSelection) can be
 * swapped for more than one paragraph/heading, because the replacement lands
 * at that block's own boundaries instead of splicing new blocks into the
 * middle of running inline content. Still rejects anything that isn't plain
 * paragraph/heading text — this is a block *count* relaxation, not a content
 * one.
 */
export function inlineReviewBlocks(fragment: JSONContent[]): JSONContent[] | null {
  if (fragment.length === 0 || !fragment.every(isReviewableBlock)) return null;
  return structuredClone(fragment);
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
 * True only when [from, to] spans a block's entire content — not a partial
 * selection within it. Only then can a multi-block reply safely replace it:
 * the swap happens at the block's own boundaries, so it can't fracture
 * running inline text the person didn't select.
 */
export function isWholeBlockSelection(editor: Editor, from: number, to: number): boolean {
  if (!isPlainTextSelection(editor, from, to)) return false;
  const $from = editor.state.doc.resolve(from);
  return from === $from.start() && to === $from.end();
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
  if (isPlainTextSelection(editor, normalizedFrom, normalizedTo)) {
    return { from: normalizedFrom, to: normalizedTo };
  }

  return clampCrossBlockOvershoot(editor, normalizedFrom, normalizedTo);
}

/**
 * A paragraph sandwiched between two other blocks (headings are the common
 * case) means a drag meant to cover just that paragraph easily grabs a
 * character or two of the neighbour instead — the two ends then resolve into
 * different parent blocks even though nothing about the visible text looks
 * unusual. Recover by clamping to whichever block holds the larger share of
 * the selection, but only when the other side is a small overshoot rather
 * than a whole adjacent block the person deliberately included too (that
 * case is a genuine multi-block selection and stays rejected).
 */
function clampCrossBlockOvershoot(
  editor: Editor,
  from: number,
  to: number,
): { from: number; to: number } | null {
  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);
  if (!$from.parent.isTextblock || !$to.parent.isTextblock || $from.parent === $to.parent) {
    return null;
  }

  const fromBlockStart = $from.start();
  const fromBlockEnd = $from.end();
  const toBlockStart = $to.start();
  const toBlockEnd = $to.end();
  const shareInFromBlock = fromBlockEnd - from;
  const shareInToBlock = to - toBlockStart;

  const candidate =
    shareInFromBlock >= shareInToBlock
      ? shareInToBlock < toBlockEnd - toBlockStart
        ? { from, to: fromBlockEnd }
        : null
      : shareInFromBlock < fromBlockEnd - fromBlockStart
        ? { from: toBlockStart, to }
        : null;

  return candidate && isPlainTextSelection(editor, candidate.from, candidate.to) ? candidate : null;
}
