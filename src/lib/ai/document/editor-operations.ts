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
