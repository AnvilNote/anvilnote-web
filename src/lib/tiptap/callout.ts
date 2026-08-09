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
  // covers it renderer-side with no extra handling either. mermaid included
  // for the same reason as image — an atom node, no separate renderer-side
  // handling needed. imageRow included so side-by-side subfigures can sit
  // inside a callout too — its own tiptap-to-typst.ts case handles the
  // subpar.grid() emission regardless of nesting depth. table included for
  // the same reason — renderTable() is called generically from renderBlocks()
  // regardless of nesting, same as every other case here.
  // chart included for the same reason as image/mermaid — an atom node
  // whose tiptap-to-typst.ts case (embeds the cached staticImage via
  // renderImage(), same as every other visual node) is already called
  // generically by renderBlocks() regardless of nesting depth, so no
  // renderer-side change was needed to support this. question included so
  // a question block (single/multi-choice or written) can be dragged or
  // slash-inserted into a callout (e.g. a "warning" callout containing a
  // sample exam question) — tiptap-to-typst.ts's own "question" case is
  // already a pure container that recurses via renderBlocks(), so this too
  // needed no renderer-side change, only this content-spec addition; the
  // drag-handle's own drop validation is schema-driven (ProseMirror checks
  // the target content expression), so without "question" here the block
  // would silently refuse to drop into a callout with no error shown.
  content: "(paragraph|bulletList|orderedList|codeBlock|blockMath|image|proof|mermaid|imageRow|table|chart|question)+",
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
      // Per-instance override of the kind's own preset background — null
      // means "use the kind's palette" (the default, and what every callout
      // had before this existed). Applies identically in light and dark
      // mode (unlike the kind palette's own light/dark pair) since the user
      // picked this exact color deliberately; accent/border color still
      // always comes from the kind, this only ever touches the fill.
      customBackground: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-custom-background") || null,
        renderHTML: (attributes) =>
          attributes.customBackground ? { "data-custom-background": attributes.customBackground } : {},
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
