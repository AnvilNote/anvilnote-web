import type { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "@/components/editor/node-views/image-node-view";

// Image node extended with AnvilNote attributes the renderer reads:
//   width — percentage of the editor/page width (null = natural size)
//   align — left | center | right
// Both round-trip through data-* so they survive serialization. Images are
// stored inline as data URLs (no upload backend), which the renderer decodes
// to a file for Typst's `image(...)`.
export const AnvilImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) =>
          attributes.caption ? { "data-caption": attributes.caption } : {},
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-width");
          return value ? Number(value) : null;
        },
        renderHTML: (attributes) =>
          attributes.width != null ? { "data-width": attributes.width } : {},
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") ?? "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
}).configure({
  inline: false,
  allowBase64: true,
});

// Open a file picker and insert the chosen image inline as a data URL.
export function pickAndInsertImage(editor: Editor) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      if (typeof src === "string") {
        editor.chain().focus().setImage({ src }).run();
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
