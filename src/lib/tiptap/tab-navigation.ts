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
export const TabNavigation = Extension.create({
  name: "tabNavigation",
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { state } = this.editor;
        const { $to } = state.selection;
        const afterCurrentBlock = $to.end($to.depth) + 1;
        if (afterCurrentBlock > state.doc.content.size) return false;
        const next = Selection.findFrom(
          state.doc.resolve(afterCurrentBlock),
          1,
          true,
        );
        if (!next) return false;
        return this.editor.chain().focus().setTextSelection(next.from).scrollIntoView().run();
      },
      "Shift-Tab": () => {
        const { state } = this.editor;
        const { $from } = state.selection;
        const beforeCurrentBlock = $from.start($from.depth) - 1;
        if (beforeCurrentBlock < 0) return false;
        const prev = Selection.findFrom(
          state.doc.resolve(beforeCurrentBlock),
          -1,
          true,
        );
        if (!prev) return false;
        return this.editor.chain().focus().setTextSelection(prev.from).scrollIntoView().run();
      },
    };
  },
});
