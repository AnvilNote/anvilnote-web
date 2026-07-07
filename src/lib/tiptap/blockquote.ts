import { Blockquote } from "@tiptap/extension-blockquote";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockquoteNodeView } from "@/components/editor/node-views/blockquote-node-view";

// Extends Tiptap's own Blockquote (same name/content/commands/keyboard
// shortcuts/input rules — "> " still works) purely to add attribution
// attrs and a NodeView; StarterKit's own blockquote is disabled in
// extensions.ts so this is the one actually registered. Keeping the same
// node name ("blockquote") and HTML tag means existing saved documents
// (which only ever had plain <blockquote> content, no author/source) still
// parse fine — the new attrs simply default to empty strings for them.
export const AnvilBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      // A person's name — rendered upright (not italic) in the Typst
      // attribution line, per the "person vs. work" distinction in
      // tiptap-to-typst.ts's blockquote case.
      author: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-author") ?? "",
        renderHTML: (attributes) =>
          attributes.author ? { "data-author": attributes.author } : {},
      },
      // A book/work title — rendered in italic in the Typst attribution
      // line.
      source: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source") ?? "",
        renderHTML: (attributes) =>
          attributes.source ? { "data-source": attributes.source } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockquoteNodeView);
  },
});
