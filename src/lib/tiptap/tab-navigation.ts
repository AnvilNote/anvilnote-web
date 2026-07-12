import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

const MATH_NODE_NAMES = new Set(["inlineMath", "blockMath"]);

type Stop = { node: PMNode; pos: number };

// Builds an ordered list of every place Tab/Shift-Tab can land: each
// textblock's own start (the normal "next place to type" stop), UNLESS
// that textblock contains a math node — inlineMath lives inside a
// textblock's own inline content, so without this a math formula sitting
// right after some plain text (e.g. "這是一段數學：$d$") would never get
// its own stop, since the textblock's bare start would already satisfy
// isTextblock and claim the position first. Math nodes (inline OR block)
// are collected as their own stop instead, at the math node's own
// position, taking priority over the enclosing textblock's start —
// scanning the textblock's children FIRST and only falling back to its
// own start if nothing inside qualified.
function collectStops(doc: PMNode): Stop[] {
  const stops: Stop[] = [];

  function visit(node: PMNode, pos: number) {
    if (MATH_NODE_NAMES.has(node.type.name)) {
      stops.push({ node, pos });
      return;
    }
    if (node.isTextblock) {
      const before = stops.length;
      node.forEach((child, offset) => visit(child, pos + 1 + offset));
      if (stops.length === before) {
        stops.push({ node, pos });
      }
      return;
    }
    node.forEach((child, offset) => visit(child, pos + 1 + offset));
  }

  doc.forEach((child, offset) => visit(child, offset));
  return stops;
}

function findStopForward(doc: PMNode, from: number): Stop | null {
  return collectStops(doc).find((stop) => stop.pos >= from) ?? null;
}

function findStopBackward(doc: PMNode, before: number): Stop | null {
  const stops = collectStops(doc).filter((stop) => stop.pos < before);
  return stops.length > 0 ? stops[stops.length - 1] : null;
}

export type TabNavigationOptions = {
  // Landing on a math stop opens its edit dialog directly (same one a
  // click on the formula opens — see extensions.ts's Mathematics
  // .configure({ inlineOptions/blockOptions: { onClick } }) — rather than
  // just placing a NodeSelection on it.
  onMathClick: (mode: "inline" | "block", pos: number, latex: string, refName?: string) => void;
};

function openMathAt(
  onMathClick: TabNavigationOptions["onMathClick"],
  node: PMNode,
  pos: number,
) {
  onMathClick(
    node.type.name === "blockMath" ? "block" : "inline",
    pos,
    String(node.attrs.latex ?? ""),
    typeof node.attrs.refName === "string" ? node.attrs.refName : undefined,
  );
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
export const TabNavigation = Extension.create<TabNavigationOptions>({
  name: "tabNavigation",
  addOptions() {
    return { onMathClick: () => {} };
  },
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
        const target =
          findStopForward(state.doc, state.selection.to) ?? findStopForward(state.doc, 0);
        if (!target) return false;
        if (MATH_NODE_NAMES.has(target.node.type.name)) {
          openMathAt(this.options.onMathClick, target.node, target.pos);
          return true;
        }
        dispatch(
          state.tr.setSelection(TextSelection.create(state.doc, target.pos + 1)).scrollIntoView(),
        );
        view.focus();
        return true;
      },
      "Shift-Tab": () => {
        const { view } = this.editor;
        const { state, dispatch } = view;
        const target =
          findStopBackward(state.doc, state.selection.from) ??
          findStopBackward(state.doc, state.doc.content.size);
        if (!target) return false;
        if (MATH_NODE_NAMES.has(target.node.type.name)) {
          openMathAt(this.options.onMathClick, target.node, target.pos);
          return true;
        }
        dispatch(
          state.tr.setSelection(TextSelection.create(state.doc, target.pos + 1)).scrollIntoView(),
        );
        view.focus();
        return true;
      },
    };
  },
});
