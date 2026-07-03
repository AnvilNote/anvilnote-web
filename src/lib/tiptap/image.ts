import type { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "@/components/editor/node-views/image-node-view";
import { renderPdfFirstPageToPng } from "@/lib/tiptap/pdf-thumbnail";

// Matches exactly what anvilnote-renderer's tiptap-to-typst.ts can embed
// (Typst's image() function — PDF support landed in Typst 0.14). Keeping
// the picker's accept list and the renderer's supported-MIME map in sync by
// hand like this is imperfect, but the two live in different repos with no
// shared package to import a single source of truth from.
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
] as const;

// Image node extended with AnvilNote attributes the renderer reads:
//   width  — percentage of the editor/page width (null = natural size)
//   align  — left | center | right
//   pdfSrc — set only when the inserted file was a PDF: the ORIGINAL PDF as
//            a data URL, kept alongside `src` (a rasterized PNG preview —
//            see pdf-thumbnail.ts) because the browser's <img> tag cannot
//            display application/pdf at all, but Typst can embed the PDF
//            itself natively at export time. The renderer prefers pdfSrc
//            over src when present; every other exporter (docx, markdown)
//            keeps using src, since Word/Markdown can't inline a PDF either.
// All three round-trip through data-* so they survive serialization. Images
// are stored inline as data URLs (no upload backend); the renderer decodes
// them to a file for Typst's `image(...)`.
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
      pdfSrc: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-pdf-src") ?? null,
        renderHTML: (attributes) =>
          attributes.pdfSrc ? { "data-pdf-src": attributes.pdfSrc } : {},
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader did not return a data URL"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

// Open a file picker and insert the chosen file as an image node. PDFs get
// rasterized to a PNG for the editor's own <img>-based preview, with the
// original PDF kept alongside for export — see the AnvilImage doc comment
// above. `onError` covers two distinct failure cases with one callback: the
// OS file dialog's `accept` filter is only a hint (most pickers still offer
// an "all files" escape hatch), and a PDF page can fail to rasterize (e.g.
// a corrupt or password-protected file) — both need to surface to the user
// instead of silently inserting something broken.
export function pickAndInsertImage(editor: Editor, onError?: (kind: "unsupported" | "pdfRenderFailed") => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = SUPPORTED_IMAGE_MIME_TYPES.join(",");
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!SUPPORTED_IMAGE_MIME_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number])) {
      onError?.("unsupported");
      return;
    }

    if (file.type === "application/pdf") {
      Promise.all([renderPdfFirstPageToPng(file), readAsDataUrl(file)])
        .then(([png, pdfSrc]) => {
          // setImage's command type only knows src/alt/title (it's just
          // `insertContent({ type: "image", attrs: options })` under the
          // hood — see @tiptap/extension-image's source), so pdfSrc, an
          // AnvilImage-only attribute, has to go through insertContent
          // directly instead of fighting that narrower type.
          editor
            .chain()
            .focus()
            .insertContent({ type: "image", attrs: { src: png, pdfSrc } })
            .run();
        })
        .catch((error) => {
          console.error("Failed to rasterize PDF for preview:", error);
          onError?.("pdfRenderFailed");
        });
      return;
    }

    readAsDataUrl(file)
      .then((src) => {
        editor.chain().focus().setImage({ src }).run();
      })
      .catch((error) => {
        console.error("Failed to read image file:", error);
        onError?.("unsupported");
      });
  };
  input.click();
}
