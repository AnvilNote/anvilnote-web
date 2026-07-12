import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";

// blockMath is an atom with no editable content (see math.ts), so plain
// Selection.findFrom(..., textblockOnly: true) walks straight past it —
// same reasoning MathArrowSelect (math.ts) exists for arrow keys. Treated
// as a stop alongside textblocks here so Tab can land on it as a
// NodeSelection instead of skipping it. inlineMath doesn't need its own
// entry here — it lives INSIDE a textblock's inline content, so landing
// in that textblock (the normal stop) already puts the cursor near it,
// and MathArrowSelect's ArrowLeft/Right takes over from there.
function isStop(node: PMNode): boolean {
  return node.type.name === "blockMath" || node.isTextblock;
}

function selectionForStop(doc: PMNode, node: PMNode, pos: number): Selection {
  return node.type.name === "blockMath"
    ? NodeSelection.create(doc, pos)
    : TextSelection.create(doc, pos + 1);
}

function findStopForward(doc: PMNode, from: number): Selection | null {
  let result: Selection | null = null;
  doc.descendants((node, pos) => {
    if (result) return false;
    if (pos + node.nodeSize <= from) return false;
    if (pos >= from && isStop(node)) {
      result = selectionForStop(doc, node, pos);
      return false;
    }
    return true;
  });
  return result;
}

function findStopBackward(doc: PMNode, before: number): Selection | null {
  let result: Selection | null = null;
  doc.descendants((node, pos) => {
    if (pos >= before) return false;
    if (isStop(node)) {
      // Keeps overwriting as it scans forward from the doc start, so the
      // last match found (closest to `before`) wins.
      result = selectionForStop(doc, node, pos);
      return false;
    }
    return true;
  });
  return result;
}

// Registered AFTER StarterKit in extensions.ts, so its own ListItem
// Tab/Shift-Tab bindings (sink/lift) are tried first — this only fires as a
// fallback (not in a list, or already at the list's own boundary).
//
// Without this, pressing Tab inside the editor has no ProseMirror-level
// handler at all, so it falls through to the browser's native DOM focus
// order — which lands on the nearest node-view control button (e.g. a
// question item's kind-menu or delete button) instead of moving the text
// cursor anywhere.
//
// Tab must never leave the editor (escaping to the browser's native focus
// order is exactly the bug this extension exists to fix) — at the last
// stop, wrap back around to the first one instead of falling through to
// `false`/native handling. Same for Shift-Tab at the first stop, wrapping
// to the last one.
export const TabNavigation = Extension.create({
  name: "tabNavigation",
  addKeyboardShortcuts() {
    return {
      // Raw tr.setSelection + literal `return true`, not a
      // .chain()...run() whose aggregate boolean depends on every
      // sub-command (focus()/scrollIntoView()) individually succeeding —
      // if any of those returned false the whole chain's return value
      // would too, and ProseMirror only calls preventDefault() when the
      // bound command returns true, letting the native Tab-to-next-DOM-
      // element behavior ALSO fire right after. Same pattern
      // question.ts's insertQuestion uses for the same reason.
      Tab: () => {
        const { view } = this.editor;
        const { state, dispatch } = view;
        const { selection } = state;
        // selection.to already means "one past the selected content" for
        // BOTH a NodeSelection (e.g. currently sitting on a blockMath from
        // a previous Tab) and a collapsed TextSelection at a block
        // boundary — using it directly (rather than the previous
        // $to.end($to.depth)+1 dance, which assumed a TextSelection)
        // avoids mis-searching from mid-node when the current selection
        // is already a NodeSelection.
        const target =
          findStopForward(state.doc, selection.to) ?? findStopForward(state.doc, 0);
        if (!target) return false;
        dispatch(state.tr.setSelection(target).scrollIntoView());
        view.focus();
        return true;
      },
      "Shift-Tab": () => {
        const { view } = this.editor;
        const { state, dispatch } = view;
        const { selection } = state;
        const target =
          findStopBackward(state.doc, selection.from) ??
          findStopBackward(state.doc, state.doc.content.size);
        if (!target) return false;
        dispatch(state.tr.setSelection(target).scrollIntoView());
        view.focus();
        return true;
      },
    };
  },
});
