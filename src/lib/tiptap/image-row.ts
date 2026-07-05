import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageRowNodeView } from "@/components/editor/node-views/image-row-node-view";

// Side-by-side images, each with its own independent caption (subfigure
// style — explicit ask, not a single shared caption for the whole row).
// Content is real `image` nodes (not a separate lightweight type), so each
// one keeps its own full image-node-view.tsx behavior (caption input,
// per-image resize, crop, zoom) for free — imageRow only owns the side-by-
// side grid layout around them. "image{2,}" requires at least 2 (a row of
// one image is just a plain image).
//
// Cross-ref: the row itself gets one figure number ("圖1"); each child
// image gets a letter and displays as "圖1(a)"/"圖1(b)" when referenced —
// see cross-ref.ts's imageRow branch and cross-ref-labels.ts's "figureSub"
// kind. That parenthesized-letter format is computed entirely on
// AnvilNote's own side, not sourced from the Typst renderer's subpar
// package (same reasoning as equations' "式 (1)" format — see
// cross-ref-labels.ts's own comment on why Typst's native numbering
// composition isn't used for that).
export const AnvilImageRow = Node.create({
  name: "imageRow",
  group: "block",
  content: "image{2,}",

  addAttributes() {
    return {
      // Shared caption for the WHOLE row ("圖 1: 兩種方法比較"), on top of
      // each child image's own individual caption ("(a) 分段函數") — added
      // per explicit feedback after subpar's own grid() caption: [...]
      // option was seen rendering just the per-child ones. Optional: an
      // empty row caption renders no caption line at all, same convention
      // as AnvilImage's own caption.
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) =>
          attributes.caption ? { "data-caption": attributes.caption } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-row"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "image-row" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageRowNodeView);
  },
});
