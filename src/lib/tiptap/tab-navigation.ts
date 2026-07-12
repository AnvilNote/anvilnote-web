import { Extension } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

// Registered AFTER StarterKit in extensions.ts, so its own ListItem
// Tab/Shift-Tab bindings (sink/lift) are tried first — this only fires as a
// fallback (not in a list, or already at the list's own boundary).
//
// Without this, pressing Tab inside the editor has no ProseMirror-level
// handler at all, so it falls through to the browser's native DOM focus
// order — which lands on the nearest node-view control button (e.g. a
// question item's kind-menu or delete button) instead of moving the text
// cursor anywhere. Using Selection.findFrom(..., textblockOnly: true)
// instead of DOM focus navigation means it only ever lands on an actual
// typeable position, skipping over atom nodes (images, blanks, dividers,
// math) and node-view chrome entirely, since neither has a corresponding
// ProseMirror text position to land on.
// Tab must never leave the editor (escaping to the browser's native focus
// order is exactly the bug this extension exists to fix) — at the last
// textblock, wrap back around to the first one instead of falling through
// to `false`/native handling. Same for Shift-Tab at the first textblock,
// wrapping to the last one.
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
        const { $to } = state.selection;
        const afterCurrentBlock = $to.end($to.depth) + 1;
        const next =
          afterCurrentBlock <= state.doc.content.size
            ? Selection.findFrom(state.doc.resolve(afterCurrentBlock), 1, true)
            : null;
        const target = next ?? Selection.findFrom(state.doc.resolve(0), 1, true);
        if (!target) return false;
        dispatch(state.tr.setSelection(target).scrollIntoView());
        view.focus();
        return true;
      },
      "Shift-Tab": () => {
        const { view } = this.editor;
        const { state, dispatch } = view;
        const { $from } = state.selection;
        const beforeCurrentBlock = $from.start($from.depth) - 1;
        const prev =
          beforeCurrentBlock >= 0
            ? Selection.findFrom(state.doc.resolve(beforeCurrentBlock), -1, true)
            : null;
        const target =
          prev ?? Selection.findFrom(state.doc.resolve(state.doc.content.size), -1, true);
        if (!target) return false;
        dispatch(state.tr.setSelection(target).scrollIntoView());
        view.focus();
        return true;
      },
    };
  },
});
