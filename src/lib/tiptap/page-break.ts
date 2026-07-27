import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PageBreakNodeView } from "@/components/editor/page-break-node-view";

export type PageBreakOptions = {
  weak?: boolean;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: (options?: PageBreakOptions) => ReturnType;
    };
  }
}

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      weak: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-weak") === "true",
        renderHTML: (attributes) => ({
          "data-weak": attributes.weak ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const weak = node.attrs.weak === true;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "page-break",
        "aria-label": weak ? "#pagebreak(weak: true)" : "#pagebreak()",
        role: "separator",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageBreakNodeView);
  },

  addCommands() {
    return {
      insertPageBreak:
        (options = {}) =>
        ({ commands }) =>
          commands.insertContent([
            {
              type: this.name,
              attrs: { weak: options.weak === true },
            },
            { type: "paragraph" },
          ]),
    };
  },
});

export function insertPageBreak(editor: Editor, weak: boolean) {
  return editor.chain().focus().insertPageBreak({ weak }).run();
}
