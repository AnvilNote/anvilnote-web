import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  DEFAULT_CALLOUT_KIND,
  normalizeCalloutKind,
} from "@/config/callouts";
import { CalloutNodeView } from "@/components/editor/node-views/callout-node-view";

// Callout: an admonition-style box (kind + title + paragraph/list/code/math/image
// body), modeled on Obsidian's callout syntax. Kind drives accent/background color
// (both the web preview and the Typst renderer look these up from the same
// 12-entry palette; see src/config/callouts.ts). `titleTouched` tracks whether the
// user has edited the title away from its kind's auto-filled default, so switching
// kind only re-seeds the title while it's still pristine.
export const AnvilCallout = Node.create({
  name: "callout",
  group: "block",
  // blockMath included so the $$$...$$$ display-math shortcut (and the math
  // dialog) works inside a callout the same as it does at the top level —
  // matches AnvilFootnote's own content spec in math.ts for the same reason.
  // image included so the slash-menu/toolbar image insert also works inside
  // a callout; the Typst renderer's callout case renders its content via
  // the same renderBlocks() used everywhere else, so image (and its
  // caption/cross-ref label) needs no separate handling there. proof
  // included so a proof can sit inside a callout (e.g. a "definition" or
  // "theorem" callout containing its own proof) — same renderBlocks() path
  // covers it renderer-side with no extra handling either.
  content: "(paragraph|bulletList|orderedList|codeBlock|blockMath|image|proof)+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: "note",
        parseHTML: (element) => normalizeCalloutKind(element.getAttribute("data-kind")),
        renderHTML: (attributes) => ({ "data-kind": normalizeCalloutKind(attributes.kind) }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") ?? "",
        renderHTML: (attributes) => ({ "data-title": attributes.title ?? "" }),
      },
      titleTouched: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-title-touched") === "true",
        renderHTML: (attributes) => ({
          "data-title-touched": attributes.titleTouched ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  // Plain Enter creates a new paragraph *inside* the callout (needed for
  // multi-paragraph callouts, and the default behavior anyway since
  // `isolating: true` blocks the normal "double-Enter on an empty trailing
  // paragraph lifts out" pattern most block containers get for free).
  // Shift-Enter is the explicit "leave the callout" gesture instead.
  addKeyboardShortcuts() {
    return {
      "Shift-Enter": () => {
        const { $from } = this.editor.state.selection;
        let calloutDepth = -1;
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type.name === this.name) {
            calloutDepth = d;
            break;
          }
        }
        if (calloutDepth === -1) return false;

        const afterPos = $from.after(calloutDepth);
        return this.editor
          .chain()
          .insertContentAt(afterPos, { type: "paragraph" })
          .setTextSelection(afterPos + 1)
          .focus()
          .run();
      },
      // Per explicit feedback: inside a callout, Tab on a list item is NOT
      // "indent into a nested list" (sinkListItem's default meaning) — it's
      // "demote this item to a plain paragraph sitting under the previous
      // item" (e.g. typing "1. foo", pressing Enter for a fresh "2.", then
      // Tab to turn that empty "2." into an unnumbered continuation
      // paragraph of "1." instead). When there IS a previous sibling item,
      // joinBackward (Tiptap's core wrapper for prosemirror-commands'
      // function, the same one Backspace-at-start-of-block uses) merges the
      // current item's content into the end of that previous item's content
      // — listItem's own content spec ("paragraph block*", see
      // @tiptap/extension-list's ListItem) already allows more than one
      // child block, so this doesn't need any hand-rolled splitting.
      // joinBackward itself guards on cursor-at-block-start, so calling it
      // from elsewhere in the item is a safe no-op, not a stray edit.
      //
      // A list item with NO previous sibling (index 0 — the callout's very
      // first/only item) has nothing to merge into; that's the original
      // fallback from before this feedback — sinkListItem declining (no
      // earlier item to become a child of) falls through to liftListItem,
      // which already demotes to a plain paragraph via its own
      // liftOutOfList path (see prosemirror-schema-list) when there's no
      // outer list item to lift into either.
      Tab: () => {
        const { $from } = this.editor.state.selection;
        const inCallout = Array.from({ length: $from.depth }, (_, i) => i + 1).some(
          (d) => $from.node(d).type.name === this.name,
        );
        if (!inCallout) return false;

        let itemDepth = -1;
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type.name === "listItem") {
            itemDepth = d;
            break;
          }
        }
        const hasPreviousSibling = itemDepth > 0 && $from.index(itemDepth - 1) > 0;
        if (hasPreviousSibling && this.editor.commands.joinBackward()) return true;

        if (this.editor.commands.sinkListItem("listItem")) return true;
        return this.editor.commands.liftListItem("listItem");
      },
    };
  },
});

// Insert a fresh callout with its kind's localized default title (titleTouched
// starts false so the node view keeps the title in sync until the user edits
// it). `defaultTitle` is the caller's already-translated string for `kind`.
export function insertCallout(
  editor: Editor,
  kind: string = DEFAULT_CALLOUT_KIND,
  defaultTitle: string,
) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "callout",
      attrs: { kind: normalizeCalloutKind(kind), title: defaultTitle, titleTouched: false },
      content: [{ type: "paragraph" }],
    })
    .run();
}
