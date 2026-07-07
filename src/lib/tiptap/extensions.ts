import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Document from "@tiptap/extension-document";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Footnotes, Footnote, FootnoteReference } from "tiptap-footnotes";
import { FootnotesNodeView } from "@/components/editor/node-views/footnotes-node-view";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table, TableView } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Mathematics } from "@tiptap/extension-mathematics";
import { BlockMathExit } from "@/lib/tiptap/math";
import { AnvilBlockquote } from "@/lib/tiptap/blockquote";
import { AnvilCodeBlock } from "@/lib/tiptap/code-block";
import { AnvilImage } from "@/lib/tiptap/image";
import { AnvilCallout } from "@/lib/tiptap/callout";
import { AnvilProof } from "@/lib/tiptap/proof";
import { AnvilMermaid } from "@/lib/tiptap/mermaid";
import { AnvilFunctionPlot } from "./function-plot";
import { AnvilStatsChart } from "./stats-chart";
import { AnvilImageRow } from "@/lib/tiptap/image-row";
import { CrossRef, CrossRefTargetIds } from "@/lib/tiptap/cross-ref";
import { CrossRefSuggestion } from "@/components/editor/cross-ref-suggestion";
import { captionHasMath, renderCaptionHtml } from "@/lib/tiptap/caption-math";

export type TableVariant = "normal" | "three-line";
export type TableAlign = "left" | "center" | "right";

class AnvilTableView extends TableView {
  private readonly viewInstance;
  private readonly captionInput: HTMLInputElement;
  // Shown instead of captionInput whenever the caption has $$...$$ math and
  // isn't currently focused for editing — mirrors caption-input.tsx's React
  // version (image captions), reimplemented with plain DOM here since
  // AnvilTableView is a vanilla TableView subclass, not a React NodeView.
  private readonly captionDisplay: HTMLDivElement;

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
    const deleteLabel =
      typeof HTMLAttributes["data-delete-label"] === "string"
        ? HTMLAttributes["data-delete-label"]
        : "Delete";

    // Vanilla DOM delete button — same bottom-right corner pattern as
    // callout/proof/codeBlock/mermaid's own React NodeView delete buttons,
    // hand-rolled here since AnvilTableView is a plain TableView subclass,
    // not a React NodeView. Icon markup copied verbatim from lucide-react's
    // own Trash2 SVG (no lucide-react import available in vanilla DOM code).
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "anvil-table__delete";
    deleteButton.setAttribute("aria-label", deleteLabel);
    deleteButton.title = deleteLabel;
    deleteButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    deleteButton.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    deleteButton.addEventListener("click", () => {
      this.deleteTable();
    });

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
      this.syncCaptionDisplayMode();
    });

    this.captionDisplay = document.createElement("div");
    this.captionDisplay.className = "anvil-caption-input";
    this.captionDisplay.tabIndex = 0;
    this.captionDisplay.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    this.captionDisplay.addEventListener("click", () => {
      this.captionDisplay.hidden = true;
      this.captionInput.hidden = false;
      this.captionInput.focus();
    });

    caption.append(label, this.captionInput, this.captionDisplay);
    this.dom.append(caption, deleteButton);

    this.syncWrapperAttrs();
  }

  // Same "search up from a DOM position for the ancestor node matching
  // this.node.type" approach as updateCaption below — the only way to find
  // this table's own current document position from inside a vanilla
  // NodeView, which isn't handed its position directly the way a React
  // NodeView's deleteNode prop already resolves it.
  private deleteTable() {
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
                this.viewInstance.state.tr.delete(pos, pos + target.nodeSize),
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
    this.syncCaptionDisplayMode();
  }

  // Shows captionDisplay (KaTeX-rendered) instead of captionInput whenever
  // the caption has $$...$$ math and isn't the currently-focused input —
  // matches caption-input.tsx's "never leaves <input> mode for plain-text
  // captions" behavior: a caption with no math segment always keeps the
  // plain input visible, no click-to-edit step to discover.
  private syncCaptionDisplayMode() {
    if (document.activeElement === this.captionInput) return;
    const caption = this.captionInput.value;
    const showDisplay = caption.length > 0 && captionHasMath(caption);
    this.captionDisplay.hidden = !showDisplay;
    this.captionInput.hidden = showDisplay;
    if (showDisplay) {
      this.captionDisplay.innerHTML = renderCaptionHtml(caption);
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
  deleteLabel: string,
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
        "data-delete-label": deleteLabel,
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

// The footnotes list (tiptap-footnotes' `Footnotes` node) has to be a
// trailing sibling of the document's regular content, not nested inside it —
// hence the custom top-level Document schema instead of StarterKit's default
// "block+". StarterKit's own `document` is disabled below to avoid a
// duplicate-node-name registration.
const AnvilDocument = Document.extend({
  content: "block+ footnotes?",
});

// Pins itself to the bottom of the editor column via CSS — see
// footnotes-node-view.tsx.
const AnvilFootnotes = Footnotes.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FootnotesNodeView);
  },
});

// The package defaults a footnote's content to "paragraph+" (no block math,
// code blocks, lists, etc.); widen it to also allow blockMath so users can
// write display equations inside a footnote, matching what inlineMath
// already allows for free (it's in paragraph's own "inline*" content).
const AnvilFootnote = Footnote.configure({
  content: "(paragraph | blockMath)+",
});

export type MathClickMode = "inline" | "block";

export type BuildExtensionsOptions = {
  placeholder: string;
  figureLabel: string;
  tableLabel: string;
  figureCaptionPlaceholder: string;
  tableCaptionPlaceholder: string;
  tableDeleteLabel: string;
  // Called when a rendered formula is clicked, so the editor can open the math
  // dialog seeded with the existing LaTeX and its document position (and, for
  // block math, its optional cross-ref display name).
  onMathClick: (mode: MathClickMode, pos: number, latex: string, refName?: string) => void;
};

export function buildExtensions({
  placeholder,
  figureLabel,
  tableLabel,
  figureCaptionPlaceholder,
  tableCaptionPlaceholder,
  tableDeleteLabel,
  onMathClick,
}: BuildExtensionsOptions): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Replaced by CodeBlockLowlight below for syntax highlighting.
      codeBlock: false,
      // Replaced by AnvilDocument below so the footnotes list can live as a
      // trailing sibling of the document's regular content.
      document: false,
      // Replaced by AnvilBlockquote below, which adds author/source
      // attribution attrs + a NodeView on top of the same node
      // name/content/commands/keyboard shortcuts/input rules.
      blockquote: false,
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
    }),
    AnvilDocument,
    AnvilBlockquote,
    AnvilFootnotes,
    AnvilFootnote,
    FootnoteReference,
    Placeholder.configure({ placeholder }),
    Typography,
    // TextStyle + Color back the per-block text color set from the block handle.
    TextStyle,
    Color,
    AnvilCodeBlock,
    AnvilCallout,
    AnvilProof,
    AnvilMermaid,
    AnvilFunctionPlot,
    AnvilStatsChart,
    AnvilImageRow,
    AnvilImage.configure({
      HTMLAttributes: {
        "data-caption-label": figureLabel,
        "data-caption-placeholder": figureCaptionPlaceholder,
      },
    }),
    AnvilTable.configure({
      resizable: true,
      View: createAnvilTableView(tableLabel, tableCaptionPlaceholder, tableDeleteLabel),
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
          onMathClick(
            "block",
            pos,
            String(node.attrs.latex ?? ""),
            typeof node.attrs.refName === "string" ? node.attrs.refName : undefined,
          ),
      },
    }),
    BlockMathExit,
    CrossRefTargetIds,
    CrossRef,
    CrossRefSuggestion,
  ];
}
