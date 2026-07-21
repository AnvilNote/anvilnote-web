import type { Editor, JSONContent } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

export interface AIApplyRange {
  from: number;
  to: number;
}

export function isEmptyEditorDocument(editor: Editor): boolean {
  const { doc } = editor.state;
  return (
    doc.childCount === 1 &&
    Boolean(doc.firstChild?.isTextblock) &&
    doc.firstChild?.content.size === 0
  );
}

export function applyAIContent(
  editor: Editor,
  range: AIApplyRange,
  content: JSONContent[],
): boolean {
  if (
    content.length === 0 ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > editor.state.doc.content.size
  ) {
    return false;
  }

  // A chain shares one ProseMirror transaction. closeHistory on that same
  // transaction starts a new undo group; the empty marker dispatched after
  // it prevents the user's next edit from joining the AI operation.
  const chain = editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      tr.setMeta("addToHistory", true);
      return true;
    });

  const replacesWholeDocument =
    range.from === 0 && range.to === editor.state.doc.content.size;
  const applied = replacesWholeDocument
    ? chain
        .command(({ tr }) => {
          const nodes = content.map((node) => editor.schema.nodeFromJSON(node));
          nodes.forEach((node) => node.check());
          tr.replaceWith(0, tr.doc.content.size, Fragment.fromArray(nodes));
          tr.setSelection(TextSelection.near(tr.doc.resolve(tr.doc.content.size), -1));
          return true;
        })
        .run()
    : chain
        .insertContentAt(range, content, {
          updateSelection: true,
          errorOnInvalidContent: true,
        })
        .run();

  if (applied) editor.view.dispatch(closeHistory(editor.state.tr));
  return applied;
}

/**
 * Applies a reviewed inline proposal without allowing a block node to split
 * or replace the surrounding paragraph. Like applyAIContent(), this remains a
 * single, history-eligible editor operation.
 */
export function applyInlineAIContent(
  editor: Editor,
  range: AIApplyRange,
  content: JSONContent[],
): boolean {
  if (
    range.from < 0 ||
    range.to < range.from ||
    range.to > editor.state.doc.content.size
  ) {
    return false;
  }

  try {
    const nodes = content.map((node) => editor.schema.nodeFromJSON(node));
    if (nodes.some((node) => !node.isInline)) return false;
    const replacement = Fragment.fromArray(nodes);
    const transaction = editor.state.tr;
    closeHistory(transaction);
    transaction.setMeta("addToHistory", true);
    transaction.replaceWith(range.from, range.to, replacement);
    const selectionPosition = Math.min(
      range.from + replacement.size,
      transaction.doc.content.size,
    );
    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(selectionPosition), -1),
    );
    editor.view.dispatch(transaction);
    editor.view.dispatch(closeHistory(editor.state.tr));
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies a reviewed proposal that itself spans more than one paragraph or
 * heading. Only valid when `range` covers a block's entire content (the
 * caller must check isWholeBlockSelection first) — the replacement then
 * lands at that block's own open/close boundaries, so several new blocks can
 * take the place of the one that stood there instead of being spliced into
 * running inline text.
 */
export function applyInlineAIBlocks(
  editor: Editor,
  range: AIApplyRange,
  blocks: JSONContent[],
): boolean {
  if (
    blocks.length === 0 ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > editor.state.doc.content.size
  ) {
    return false;
  }

  try {
    const $from = editor.state.doc.resolve(range.from);
    const $to = editor.state.doc.resolve(range.to);
    if ($from.parent !== $to.parent) return false;
    const outerFrom = $from.before();
    const outerTo = $to.after();

    const nodes = blocks.map((node) => editor.schema.nodeFromJSON(node));
    nodes.forEach((node) => node.check());
    const replacement = Fragment.fromArray(nodes);
    const transaction = editor.state.tr;
    closeHistory(transaction);
    transaction.setMeta("addToHistory", true);
    transaction.replaceWith(outerFrom, outerTo, replacement);
    const selectionPosition = Math.min(
      outerFrom + replacement.size,
      transaction.doc.content.size,
    );
    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(selectionPosition), -1),
    );
    editor.view.dispatch(transaction);
    editor.view.dispatch(closeHistory(editor.state.tr));
    return true;
  } catch {
    return false;
  }
}
