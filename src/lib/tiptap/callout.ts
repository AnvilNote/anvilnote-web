import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  DEFAULT_CALLOUT_KIND,
  normalizeCalloutKind,
} from "@/config/callouts";
import { CalloutNodeView } from "@/components/editor/node-views/callout-node-view";

// Callout: an admonition-style box (kind + title + paragraph body), modeled on
// Obsidian's callout syntax. Kind drives accent/background color (both the web
// preview and the Typst renderer look these up from the same 12-entry palette;
// see src/config/callouts.ts). `titleTouched` tracks whether the user has
// edited the title away from its kind's auto-filled default, so switching kind
// only re-seeds the title while it's still pristine.
export const AnvilCallout = Node.create({
  name: "callout",
  group: "block",
  content: "paragraph+",
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
