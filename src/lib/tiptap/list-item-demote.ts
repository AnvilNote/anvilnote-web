import { Extension } from "@tiptap/core";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

export type ListItemDemoteOptions = {
  // The extension has no i18n/toast concept of its own — it just reports
  // "this double-Tab wasn't valid here" and lets the host component decide
  // how to surface that (a toast, today).
  onBlocked: () => void;
};

// Two Tab presses this close together (and nothing else typed/clicked in
// between) count as one "double-Tab" gesture. Pure UX heuristic — a
// successful first-Tab sink shifts the document, so exact cursor-position
// correlation across the two presses isn't attempted.
const DOUBLE_TAB_WINDOW_MS = 600;

export type DemoteResult = "demoted" | "blocked" | "notInList";

// Double-Tab on a nested list item (depth >= 2) strips its own marker and
// merges its content into the end of its PARENT item, as a plain indented
// continuation line — e.g. turns "1. A / a. B" into "1. A / B" (no "a."),
// matching how a lazy-continuation line looks in the rendered Typst output
// (a listItem's `[...]` body already supports multiple block children, see
// renderList() in anvilnote-renderer's tiptap-to-typst.ts — no renderer
// change needed).
//
// Only valid when the current item is the last (or only) child of its
// list — demoting a middle item would require splitting its siblings into
// a second numbered sublist, which isn't supported.
export function demoteLastListItem(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
): DemoteResult {
  const { $from } = state.selection;

  let itemDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "listItem") {
      itemDepth = depth;
      break;
    }
  }
  if (itemDepth < 0) return "notInList";

  const listDepth = itemDepth - 1;
  const parentItemDepth = listDepth - 1;
  if (parentItemDepth < 1 || $from.node(parentItemDepth).type.name !== "listItem") {
    return "blocked";
  }

  const list = $from.node(listDepth);
  if (list.type.name !== "bulletList" && list.type.name !== "orderedList") {
    return "blocked";
  }
  if ($from.index(listDepth) !== list.childCount - 1) {
    return "blocked";
  }

  const currentItem = $from.node(itemDepth);
  const itemStart = $from.before(itemDepth);
  const itemEnd = $from.after(itemDepth);
  const listStart = $from.before(listDepth);
  const listEnd = $from.after(listDepth);

  // Where the cursor sat WITHIN currentItem's own content (0 = right at its
  // start) — used below to land the cursor at the equivalent spot inside
  // the merged content, rather than mapping the old absolute position
  // through the replace/insert (unreliable: a position sitting exactly on
  // a node boundary maps ambiguously, and TextSelection.near()'s default
  // forward bias then jumps into whatever textblock follows next — even a
  // totally unrelated one further down the document).
  const contentOffset = Math.min(
    Math.max(state.selection.from - (itemStart + 1), 0),
    currentItem.content.size,
  );

  const tr = state.tr;
  let insertPos: number;
  if (list.childCount === 1) {
    insertPos = listStart;
    tr.replaceWith(listStart, listEnd, currentItem.content);
  } else {
    tr.delete(itemStart, itemEnd);
    // Deleting the last child collapses `itemStart` to sit just BEFORE the
    // list's own closing token (mapped, `itemStart` is untouched since
    // nothing precedes it) — +1 steps past that closing token, back up to
    // parentItem's own content, right after the now-shrunk list.
    insertPos = tr.mapping.map(itemStart) + 1;
    tr.insert(insertPos, currentItem.content);
  }
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + contentOffset), -1));
  dispatch(tr.scrollIntoView());
  return "demoted";
}

export const ListItemDemote = Extension.create<ListItemDemoteOptions>({
  name: "listItemDemote",
  // Higher than the built-in ListItem sink keymap (default 100) and
  // TabNavigation (50) — needs first look at every Tab press so it can
  // silently pass the FIRST of two consecutive Tabs through unchanged
  // before the normal sink handles it.
  priority: 1000,
  addOptions() {
    return { onBlocked: () => {} };
  },
  addStorage() {
    return { lastTabAt: null as number | null };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const now = Date.now();
        const isConsecutive =
          this.storage.lastTabAt !== null && now - this.storage.lastTabAt < DOUBLE_TAB_WINDOW_MS;

        if (!isConsecutive) {
          this.storage.lastTabAt = now;
          // First Tab of a sequence — untouched, let normal sink (or
          // whatever else handles Tab) run exactly as it does today.
          return false;
        }

        this.storage.lastTabAt = null;
        const { view } = this.editor;
        const result = demoteLastListItem(view.state, view.dispatch);
        if (result === "blocked") {
          this.options.onBlocked();
          return true;
        }
        if (result === "notInList") return false;
        view.focus();
        return true;
      },
      "Shift-Tab": () => {
        this.storage.lastTabAt = null;
        return false;
      },
    };
  },
});
