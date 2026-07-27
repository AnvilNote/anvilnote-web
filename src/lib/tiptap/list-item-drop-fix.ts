import { NodeSelection } from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";
import type { Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

// `view.dragging` is set by @tiptap/extension-drag-handle's dragHandler.ts
// (and by ProseMirror's own native drag handling) but isn't part of
// EditorView's public type declaration.
type ViewWithDragging = EditorView & {
  dragging: { slice: Slice; node?: unknown } | null;
};

// Dragging a list item to just past its list's last child (its closing
// token — e.g. "below the last item") resolves the drop position at the
// enclosing block's own depth, not inside any list: a bare listItem can't
// go there directly, so ProseMirror's default handling (prosemirror-view's
// handleDrop, via dropPoint()'s second "needs wrapping" pass) auto-wraps it
// in whatever list type Schema#findWrapping finds first. That search has no
// notion of the item's original list type, so it silently always picks
// bulletList — reproduced: dragging an orderedList item past its list's end
// turned it into a bullet, losing its numbering entirely.
//
// We already know the correct type (the dragged item's own original
// parent), so this pre-empts the ambiguous auto-wrap and builds a
// correctly-typed wrapper instead. Takes an already-resolved drop position
// (rather than resolving `view.posAtCoords` itself) so the decision logic
// stays testable without needing real layout/coordinates.
export function fixMisWrappedListItemDrop(view: EditorView, dropPos: number): boolean {
  const dragging = (view as ViewWithDragging).dragging;
  const slice = dragging?.slice;
  const draggedSelection = dragging?.node instanceof NodeSelection ? dragging.node : null;
  if (
    !slice ||
    slice.openStart !== 0 ||
    slice.openEnd !== 0 ||
    slice.content.childCount !== 1 ||
    draggedSelection?.node.type.name !== "listItem"
  ) {
    return false;
  }

  const doc = view.state.doc;
  const insertPos = dropPoint(doc, dropPos, slice);
  const sourceListType = draggedSelection.$from.parent.type;
  if (
    insertPos === null ||
    (sourceListType.name !== "orderedList" && sourceListType.name !== "bulletList")
  ) {
    return false;
  }

  const insertParentType = doc.resolve(insertPos).parent.type.name;
  if (insertParentType === "bulletList" || insertParentType === "orderedList") {
    // Already lands directly inside a real list (same or intentionally a
    // different type) — no ambiguous wrap involved, default handling is
    // already correct.
    return false;
  }

  const tr = view.state.tr;
  const draggedNode = draggedSelection.node;
  draggedSelection.replace(tr);
  const mappedInsertPos = tr.mapping.map(insertPos);

  // Removing the dragged item commonly leaves the REST of its own original
  // list sitting immediately next to the (now-shrunk) insert point — e.g.
  // dropping an item past its list's last sibling maps right back to just
  // after that same list, now missing the dragged item. Extend that
  // adjacent list instead of wrapping a brand new one around just this
  // item, which would otherwise split into two separate sibling lists of
  // the same type sitting right next to each other.
  const $insert = tr.doc.resolve(mappedInsertPos);
  if ($insert.nodeBefore?.type === sourceListType) {
    tr.insert(mappedInsertPos - 1, draggedNode);
  } else if ($insert.nodeAfter?.type === sourceListType) {
    tr.insert(mappedInsertPos + 1, draggedNode);
  } else {
    tr.insert(mappedInsertPos, sourceListType.create(null, draggedNode));
  }
  view.dispatch(tr);
  return true;
}
