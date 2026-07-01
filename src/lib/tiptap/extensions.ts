import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table, TableView } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Mathematics } from "@tiptap/extension-mathematics";
import { AnvilCodeBlock } from "@/lib/tiptap/code-block";
import { AnvilImage } from "@/lib/tiptap/image";
import { AnvilCallout } from "@/lib/tiptap/callout";

export type TableVariant = "normal" | "three-line";
export type TableAlign = "left" | "center" | "right";

class AnvilTableView extends TableView {
  private readonly viewInstance;
  private readonly captionInput: HTMLInputElement;

  constructor(
    node: import("@tiptap/pm/model").Node,
    cellMinWidth: number,
    view: import("@tiptap/pm/view").EditorView,
    HTMLAttributes: Record<string, unknown> = {},
  ) {
    super(node, cellMinWidth, view, HTMLAttributes);
    this.viewInstance = view;

    const captionLabel =
      typeof HTMLAttributes["data-caption-label"] === "string"
        ? HTMLAttributes["data-caption-label"]
        : "Table";
    const captionPlaceholder =
      typeof HTMLAttributes["data-caption-placeholder"] === "string"
        ? HTMLAttributes["data-caption-placeholder"]
        : "Caption";

    const caption = document.createElement("div");
    caption.className = "anvil-table__caption";
    caption.contentEditable = "false";

    const label = document.createElement("span");
    label.className = "anvil-table__caption-label";
    label.setAttribute("data-label", captionLabel);

    this.captionInput = document.createElement("input");
    this.captionInput.type = "text";
    this.captionInput.className = "anvil-caption-input";
    this.captionInput.placeholder = captionPlaceholder;
    this.captionInput.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    this.captionInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    this.captionInput.addEventListener("input", () => {
      this.updateCaption(this.captionInput.value);
    });
    this.captionInput.addEventListener("blur", () => {
      this.updateCaption(this.captionInput.value);
    });

    caption.append(label, this.captionInput);
    this.dom.append(caption);

    this.syncWrapperAttrs();
  }

  override update(node: import("@tiptap/pm/model").Node) {
    const updated = super.update(node);
    if (updated) {
      this.syncWrapperAttrs();
    }
    return updated;
  }

  private syncWrapperAttrs() {
    const caption =
      typeof this.node.attrs.caption === "string" ? this.node.attrs.caption : "";
    const align =
      this.node.attrs.align === "left" || this.node.attrs.align === "right"
        ? this.node.attrs.align
        : "center";

    this.dom.setAttribute("data-align", align);
    if (
      document.activeElement !== this.captionInput &&
      this.captionInput.value !== caption
    ) {
      this.captionInput.value = caption;
    }
  }

  private updateCaption(caption: string) {
    const domCandidates: Node[] = [this.dom, this.table, this.contentDOM];

    for (const dom of domCandidates) {
      try {
        const domPos = this.viewInstance.posAtDOM(dom, 0);
        for (const candidate of [domPos, domPos - 1, domPos + 1]) {
          if (candidate < 0 || candidate > this.viewInstance.state.doc.content.size) {
            continue;
          }
          const resolved = this.viewInstance.state.doc.resolve(candidate);
          for (let depth = resolved.depth; depth >= 0; depth -= 1) {
            const target = resolved.node(depth);
            if (target.type === this.node.type) {
              const pos = depth === 0 ? 0 : resolved.before(depth);
              this.viewInstance.dispatch(
                this.viewInstance.state.tr.setNodeMarkup(pos, undefined, {
                  ...target.attrs,
                  caption,
                }),
              );
              return;
            }
          }
        }
      } catch {
        continue;
      }
    }
  }
}

function createAnvilTableView(
  captionLabel: string,
  captionPlaceholder: string,
) {
  return class extends AnvilTableView {
    constructor(
      node: import("@tiptap/pm/model").Node,
      cellMinWidth: number,
      view: import("@tiptap/pm/view").EditorView,
      HTMLAttributes: Record<string, unknown> = {},
    ) {
      super(node, cellMinWidth, view, {
        ...HTMLAttributes,
        "data-caption-label": captionLabel,
        "data-caption-placeholder": captionPlaceholder,
      });
    }
  };
}

// Table extended with two AnvilNote attributes the renderer reads:
//   variant — "normal" (full ruled grid) | "three-line" (booktabs 三線表)
//   align   — horizontal placement of the table block on the page
// Both round-trip through data-* attributes so they survive serialization and
// drive the in-editor CSS preview.
const AnvilTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) =>
          attributes.caption ? { "data-caption": attributes.caption } : {},
      },
      variant: {
        default: "normal",
        parseHTML: (element) => element.getAttribute("data-variant") ?? "normal",
        renderHTML: (attributes) => ({ "data-variant": attributes.variant }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") ?? "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align }),
      },
    };
  },
});

export type MathClickMode = "inline" | "block";

export type BuildExtensionsOptions = {
  placeholder: string;
  figureLabel: string;
  tableLabel: string;
  figureCaptionPlaceholder: string;
  tableCaptionPlaceholder: string;
  // Called when a rendered formula is clicked, so the editor can open the math
  // dialog seeded with the existing LaTeX and its document position.
  onMathClick: (mode: MathClickMode, pos: number, latex: string) => void;
};

export function buildExtensions({
  placeholder,
  figureLabel,
  tableLabel,
  figureCaptionPlaceholder,
  tableCaptionPlaceholder,
  onMathClick,
}: BuildExtensionsOptions): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Replaced by CodeBlockLowlight below for syntax highlighting.
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
    }),
    Placeholder.configure({ placeholder }),
    Typography,
    // TextStyle + Color back the per-block text color set from the block handle.
    TextStyle,
    Color,
    AnvilCodeBlock,
    AnvilCallout,
    AnvilImage.configure({
      HTMLAttributes: {
        "data-caption-label": figureLabel,
        "data-caption-placeholder": figureCaptionPlaceholder,
      },
    }),
    AnvilTable.configure({
      resizable: true,
      View: createAnvilTableView(tableLabel, tableCaptionPlaceholder),
    }),
    TableRow,
    TableHeader,
    TableCell,
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: {
        onClick: (node, pos) =>
          onMathClick("inline", pos, String(node.attrs.latex ?? "")),
      },
      blockOptions: {
        onClick: (node, pos) =>
          onMathClick("block", pos, String(node.attrs.latex ?? "")),
      },
    }),
  ];
}
