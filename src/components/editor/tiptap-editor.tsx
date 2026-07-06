"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ChainedCommands } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  BarChart3,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus as ImageIcon,
  Images,
  LineChart,
  List,
  ListOrdered,
  MessageSquareWarning,
  Quote,
  Sigma,
  Square,
  SquareSigma,
  Table as TableIcon,
  Type,
  Workflow,
} from "lucide-react";
import { DocumentTitle } from "@/components/editor/document-title";
import { AutosaveIndicator } from "@/components/editor/autosave-indicator";
import { TiptapToolbar } from "@/components/editor/tiptap-toolbar";
import { TiptapBubbleMenu } from "@/components/editor/tiptap-bubble-menu";
import { BlockHandle } from "@/components/editor/block-handle";
import { LinkInput } from "@/components/editor/link-input";
import { TextColorPicker } from "@/components/editor/text-color-picker";
import {
  MathEditorDialog,
  CLOSED_MATH_DIALOG,
  type MathDialogState,
} from "@/components/editor/math-editor-dialog";
import {
  createSlashCommand,
  type SlashItem,
} from "@/components/editor/slash-command-menu";
import { TableSizeDialog } from "@/components/editor/table-size-picker";
import { buildExtensions, type MathClickMode } from "@/lib/tiptap/extensions";
import {
  deleteBlockMath,
  deleteInlineMath,
  insertBlockMath,
  insertInlineMath,
  updateBlockMath,
  updateInlineMath,
} from "@/lib/tiptap/math";
import { pickAndInsertImage, pickAndInsertImageRow } from "@/lib/tiptap/image";
import { insertCallout } from "@/lib/tiptap/callout";
import { insertProof } from "@/lib/tiptap/proof";
import { insertMermaid } from "@/lib/tiptap/mermaid";
import { insertFunctionPlot } from "@/lib/tiptap/function-plot";
import { insertStatsChart } from "@/lib/tiptap/stats-chart";
import { DEFAULT_CALLOUT_KIND } from "@/config/callouts";
import { migratedDocIds } from "@/lib/tiptap/serialization";
import { emptyTiptapContent } from "@/lib/tiptap/default-content";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useEditorBridge } from "@/lib/stores/editor-bridge";

export function TiptapEditor({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const tt = useTranslations("editor.slash");

  const renameDocument = useDocumentStore((s) => s.renameDocument);
  const setContent = useDocumentStore((s) => s.setContent);
  const title = useDocumentStore(
    (s) => s.documents.find((d) => d.id === documentId)?.title ?? "",
  );
  const spellcheck = useSettingsStore((s) => s.spellcheck);

  const register = useEditorBridge((s) => s.register);
  const unregister = useEditorBridge((s) => s.unregister);

  const handleImageError = useCallback(
    (kind: "unsupported" | "pdfRenderFailed") => {
      toast.error(t(`editor.image.${kind === "unsupported" ? "unsupportedFormat" : "pdfRenderFailed"}`));
    },
    [t],
  );

  const handleImageRowError = useCallback(
    (kind: "unsupported" | "tooFew") => {
      toast.error(
        t(kind === "tooFew" ? "editor.imageRow.tooFewImages" : "editor.image.unsupportedFormat"),
      );
    },
    [t],
  );

  const [mathDialog, setMathDialog] = useState<MathDialogState>(CLOSED_MATH_DIALOG);
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);

  // Snapshot the stored content once; the editor is uncontrolled afterwards so
  // store writes never feed back and disturb the cursor / IME composition.
  const initialContent = useMemo(() => {
    const stored = useDocumentStore.getState().getDocument(documentId)?.content;
    return stored ?? emptyTiptapContent;
  }, [documentId]);

  // Editing an existing formula: open the dialog seeded from the clicked node.
  const handleMathClick = useCallback(
    (mode: MathClickMode, pos: number, latex: string, refName?: string) => {
      setMathDialog({ open: true, mode, pos, latex, refName });
    },
    [],
  );

  // Inserting a fresh formula (toolbar / slash / command menu).
  const requestMath = useCallback((mode: MathClickMode) => {
    setMathDialog({ open: true, mode, pos: null, latex: "" });
  }, []);

  // Inserting a table from the slash menu: open the size picker first.
  const requestTable = useCallback(() => setTableDialogOpen(true), []);

  // Depend on the resolved label STRINGS, not the `t` function: next-intl
  // returns a fresh `t` identity every render, so depending on `t` would rebuild
  // the extension instances each render, reconfigure ProseMirror plugins and
  // tear down the open "/" Suggestion popup. Strings are stable per locale.
  const writePlaceholder = t("editor.writePlaceholder");
  const figureLabel = t("editor.image.figure");
  const tableLabel = t("editor.table.figure");
  const figureCaptionPlaceholder = t("editor.image.captionPlaceholder");
  const tableCaptionPlaceholder = t("editor.table.captionPlaceholder");
  const tableDeleteLabel = t("editor.block.delete", { type: t("editor.block.types.table") });
  const extensions = useMemo(
    () =>
      buildExtensions({
        placeholder: writePlaceholder,
        figureLabel,
        tableLabel,
        figureCaptionPlaceholder,
        tableCaptionPlaceholder,
        tableDeleteLabel,
        onMathClick: handleMathClick,
      }),
    [
      writePlaceholder,
      figureLabel,
      tableLabel,
      figureCaptionPlaceholder,
      tableCaptionPlaceholder,
      tableDeleteLabel,
      handleMathClick,
    ],
  );

  // Slash items are rebuilt each render (labels follow locale) but read through
  // a ref so the extension instance stays stable across renders.
  const slashItems = useMemo<SlashItem[]>(() => {
    const run =
      (fn: (chain: ChainedCommands) => void) =>
        ({ editor, range }: Parameters<SlashItem["run"]>[0]) => {
          fn(editor.chain().focus().deleteRange(range));
        };
    return [
      {
        title: tt("text"),
        icon: Type,
        aliases: ["paragraph", "p", "text"],
        run: run((c) => c.setParagraph().run()),
      },
      {
        title: tt("heading1"),
        icon: Heading1,
        aliases: ["h1", "title"],
        run: run((c) => c.toggleHeading({ level: 1 }).run()),
      },
      {
        title: tt("heading2"),
        icon: Heading2,
        aliases: ["h2"],
        run: run((c) => c.toggleHeading({ level: 2 }).run()),
      },
      {
        title: tt("heading3"),
        icon: Heading3,
        aliases: ["h3"],
        run: run((c) => c.toggleHeading({ level: 3 }).run()),
      },
      {
        title: tt("bulletList"),
        icon: List,
        aliases: ["ul", "bullet", "list"],
        run: run((c) => c.toggleBulletList().run()),
      },
      {
        title: tt("orderedList"),
        icon: ListOrdered,
        aliases: ["ol", "ordered", "number"],
        run: run((c) => c.toggleOrderedList().run()),
      },
      {
        title: tt("quote"),
        icon: Quote,
        aliases: ["blockquote", "quote"],
        run: run((c) => c.toggleBlockquote().run()),
      },
      {
        title: tt("callout"),
        icon: MessageSquareWarning,
        aliases: ["callout", "admonition", "note", "warning"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          insertCallout(
            editor,
            DEFAULT_CALLOUT_KIND,
            t(`editor.callout.kinds.${DEFAULT_CALLOUT_KIND}` as never),
          );
        },
      },
      {
        title: tt("mermaid"),
        icon: Workflow,
        aliases: ["mermaid", "diagram", "flowchart", "圖表"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          insertMermaid(editor);
        },
      },
      {
        title: tt("functionPlot"),
        subtitle: tt("functionPlotHint"),
        icon: LineChart,
        aliases: ["function", "plot", "graph", "函數圖", "函數"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          insertFunctionPlot(editor);
        },
      },
      {
        title: tt("statsChart"),
        subtitle: tt("statsChartHint"),
        icon: BarChart3,
        aliases: ["stats", "chart", "bar", "pie", "統計圖", "長條圖", "圓餅圖"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          insertStatsChart(editor);
        },
      },
      {
        title: tt("proof"),
        icon: Square,
        aliases: ["proof", "qed", "證明"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          insertProof(editor);
        },
      },
      {
        title: tt("codeBlock"),
        icon: Code2,
        aliases: ["code", "codeblock", "pre", "程式碼"],
        run: run((c) => c.toggleCodeBlock().run()),
      },
      {
        title: tt("table"),
        icon: TableIcon,
        aliases: ["table", "grid"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          requestTable();
        },
      },
      {
        title: tt("image"),
        icon: ImageIcon,
        aliases: ["image", "img", "picture", "photo", "圖片"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          pickAndInsertImage(editor, handleImageError);
        },
      },
      {
        title: tt("imageRow"),
        icon: Images,
        aliases: ["imagerow", "sidebyside", "subfigure", "並排圖片", "並排"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          pickAndInsertImageRow(editor, handleImageRowError);
        },
      },
      {
        title: tt("inlineMath"),
        subtitle: tt("inlineMathHint"),
        icon: Sigma,
        aliases: ["x", "inline math", "inlinemath", "latex", "公式", "行內公式"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          requestMath("inline");
        },
      },
      {
        title: tt("blockMath"),
        subtitle: tt("blockMathHint"),
        icon: SquareSigma,
        aliases: [
          "d",
          "display",
          "block math",
          "blockmath",
          "equation",
          "公式",
          "區塊公式",
        ],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          requestMath("block");
        },
      },
    ];
  }, [t, tt, requestMath, requestTable, handleImageError, handleImageRowError]);

  // Keep the slash extension instance stable while letting it read the latest
  // (localized) items at trigger time through a ref updated in an effect.
  const slashItemsRef = useRef(slashItems);
  useEffect(() => {
    slashItemsRef.current = slashItems;
  }, [slashItems]);

  const slashCommand = useMemo(() => {
    // getItems is only invoked when the user types "/", never during render;
    // reading the ref then is the intended latest-value access.
    const getItems = () => slashItemsRef.current;
    // eslint-disable-next-line react-hooks/refs
    return createSlashCommand(getItems);
  }, []);

  // Stable option references: `useEditor` (deps: []) calls `setOptions` on every
  // render whose options differ by identity, which reconfigures ProseMirror
  // plugins and tears down any open Suggestion popup (the "/" menu). Memoizing
  // these keeps the editor — and the slash menu — alive across re-renders.
  const allExtensions = useMemo(
    () => [...extensions, slashCommand],
    [extensions, slashCommand],
  );

  const editorProps = useMemo(
    () => ({
      attributes: { class: "anvil-prose focus:outline-none" },
      // A plain left-click on a link opens it in a new tab. To edit link text,
      // select it (drag) and use the toolbar / bubble-menu link button.
      handleClick: (_view: unknown, _pos: number, event: MouseEvent) => {
        const anchor = (event.target as HTMLElement | null)?.closest?.("a");
        const href = anchor?.getAttribute("href");
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
      // Blocks dropping a dragged block into or right up against the
      // footnotes list. AnvilDocument's schema requires footnotes to stay
      // the trailing node and only accept footnote content ("block+
      // footnotes?") — a generic block-reorder drop that lands there isn't
      // schema-valid, and ProseMirror's move-via-delete-then-insert isn't
      // atomic: the delete half had already been confirmed to go through
      // even when the insert half failed, silently destroying content
      // (reproduced: dragging a paragraph near the footnotes list deleted
      // both that paragraph and the footnote's own text). Rejecting the
      // drop outright here — before any transaction is dispatched — is
      // cheaper and safer than trying to make the reorder logic itself
      // schema-aware.
      handleDrop: (view: EditorView, event: DragEvent) => {
        const coords = { left: event.clientX, top: event.clientY };
        const dropPos = view.posAtCoords(coords);
        if (!dropPos) return false;

        const doc = view.state.doc;
        const $pos = doc.resolve(dropPos.pos);
        for (let d = $pos.depth; d >= 0; d -= 1) {
          const name = $pos.node(d).type.name;
          if (name === "footnotes" || name === "footnote") return true;
        }

        const last = doc.lastChild;
        if (last?.type.name === "footnotes") {
          const footnotesStart = doc.content.size - last.nodeSize;
          if (dropPos.pos >= footnotesStart) return true;
        }
        return false;
      },
    }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: allExtensions,
    content: initialContent,
    editorProps,
    onUpdate: ({ editor: e }) => {
      setContent(documentId, e.getJSON());
    },
  });

  // Expose this editor to the global command menu while it's mounted.
  useEffect(() => {
    if (!editor) return;
    register(editor, requestMath);
    return () => unregister(editor);
  }, [editor, register, unregister, requestMath]);

  // Reflect the spellcheck preference on the editable surface. Set the DOM
  // attribute directly so the editorProps (and its handleClick) stay intact.
  useEffect(() => {
    editor?.view.dom.setAttribute("spellcheck", String(spellcheck));
  }, [editor, spellcheck]);

  // One-time notice when stored content was incompatible and got reset.
  useEffect(() => {
    if (migratedDocIds.has(documentId)) {
      migratedDocIds.delete(documentId);
      toast.warning(t("editor.oldDocReset"));
    }
  }, [documentId, t]);

  const handleMathSave = useCallback(
    (latex: string, refName?: string) => {
      if (editor) {
        const { mode, pos } = mathDialog;
        if (pos !== null) {
          if (mode === "inline") updateInlineMath(editor, pos, latex);
          else updateBlockMath(editor, pos, latex, refName);
        } else if (mode === "inline") {
          insertInlineMath(editor, latex);
        } else {
          insertBlockMath(editor, latex, refName);
        }
      }
      setMathDialog(CLOSED_MATH_DIALOG);
    },
    [editor, mathDialog],
  );

  const handleMathDelete = useCallback(() => {
    if (editor && mathDialog.pos !== null) {
      if (mathDialog.mode === "inline") deleteInlineMath(editor, mathDialog.pos);
      else deleteBlockMath(editor, mathDialog.pos);
    }
    setMathDialog(CLOSED_MATH_DIALOG);
  }, [editor, mathDialog]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sticky editor header: toolbar (left) on the same line as the autosave
          indicator (right). Stays pinned to the top while the note scrolls. */}
      <div className="@container sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        {/* pl-2, not pl-12 like the title/content rows below — those reserve
            room for the sidebar-toggle icon above them, but this is a
            working icon bar, not reading content, and the wasted space was
            exactly what made it scroll/wrap sooner than it needed to.
            @[20rem]:flex-row (a container query, keyed off this row's own
            measured width — the @container is on the parent sticky
            wrapper) with a deliberately low threshold, not lg:flex-row (a
            viewport breakpoint, which stacked with room to spare on the
            right well within any single viewport breakpoint since the
            sidebar/right panel eat into this row's actual space). The
            toolbar itself already scrolls internally when tight
            (overflow-x-auto), so this row can stay side-by-side down to
            a much smaller width than it needs for the toolbar's full
            content — flex-col is really just for genuinely narrow/mobile
            widths at this point. */}
        <div className="mx-auto flex w-full flex-col gap-1 pl-4 pr-4 py-1.5 @[20rem]:flex-row @[20rem]:items-center @[20rem]:gap-3">
          <div className="min-w-0 w-full flex-1">
            {editor ? (
              <TiptapToolbar
                editor={editor}
                onInsertMath={requestMath}
                onEditLink={() => setLinkOpen(true)}
                onImageError={handleImageError}
              />
            ) : null}
          </div>
          <div className="flex w-full justify-end @[20rem]:w-auto @[20rem]:shrink-0">
            <AutosaveIndicator documentId={documentId} />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[820px] pl-12 pr-3 pb-2 pt-4 lg:pt-8">
        <DocumentTitle
          value={title}
          onChange={(value) => renameDocument(documentId, value)}
        />
      </div>

      <div
        data-tour="editor-area"
        className="anvil-editor mx-auto w-full max-w-[820px] flex-1 pl-12 pr-3 pb-24 lg:pb-32"
        onClick={(event) => {
          if (!editor) return;
          // The footnotes panel is `position: fixed` (pinned to the bottom
          // of the column) but is still a real DOM descendant of this
          // wrapper, so clicks inside it bubble up here too. Without this
          // guard every click meant to place the cursor in a footnote got
          // hijacked and sent to the end of the body instead.
          if ((event.target as HTMLElement).closest(".anvil-footnotes-panel")) {
            return;
          }

          const doc = editor.state.doc;
          const last = doc.lastChild;
          // footnotes must stay the document's trailing node (schema:
          // "block+ footnotes?") — insert before it, not after. It's also
          // CSS `position: fixed` (pinned to the bottom of the column, see
          // footnotes-node-view.tsx), so its own rect is useless as a
          // "where does real content end" reference.
          const hasFootnotes = last?.type.name === "footnotes";
          const insertPos = hasFootnotes ? doc.content.size - last!.nodeSize : doc.content.size;
          const target = hasFootnotes ? doc.child(doc.childCount - 2) : last;
          if (!target) return;

          // The bottom padding exists so short documents still have room to
          // click below their last block. A click there lands on this
          // wrapper, not on any ProseMirror-tracked node, so it otherwise
          // does nothing — most annoyingly when the last block is an atom
          // (blockMath, image, table) with no text position to click into.
          // Compare against the last block's own rendered bottom edge, not
          // .ProseMirror's box — that has a large min-height (globals.css)
          // so short documents still have click room, which would otherwise
          // make this box cover the "empty" space too and never fire below.
          const targetPos = insertPos - target.nodeSize;
          const targetDom = editor.view.nodeDOM(targetPos);
          const targetRect =
            targetDom instanceof HTMLElement ? targetDom.getBoundingClientRect() : null;
          if (targetRect && event.clientY < targetRect.bottom) return;

          if (target.type.name === "paragraph" && target.content.size === 0) {
            editor.chain().focus().setTextSelection(insertPos).run();
            return;
          }
          editor
            .chain()
            .insertContentAt(insertPos, { type: "paragraph" })
            .focus()
            .setTextSelection(insertPos + 1)
            .run();
        }}
      >
        {editor ? (
          <>
            <TiptapBubbleMenu
              editor={editor}
              onInsertMath={requestMath}
              onEditLink={() => setLinkOpen(true)}
              onEditColor={() => setColorPickerOpen(true)}
            />
            <BlockHandle editor={editor} />
          </>
        ) : null}
        <EditorContent editor={editor} />
      </div>

      {editor && linkOpen ? (
        <LinkInput editor={editor} onClose={() => setLinkOpen(false)} />
      ) : null}

      {editor && colorPickerOpen ? (
        <TextColorPicker editor={editor} onClose={() => setColorPickerOpen(false)} />
      ) : null}

      <MathEditorDialog
        state={mathDialog}
        onOpenChange={(open) => {
          if (!open) setMathDialog(CLOSED_MATH_DIALOG);
        }}
        onSave={handleMathSave}
        onDelete={handleMathDelete}
      />

      <TableSizeDialog
        open={tableDialogOpen}
        onOpenChange={setTableDialogOpen}
        onPick={(rows, cols) =>
          editor
            ?.chain()
            .focus()
            .insertTable({ rows, cols, withHeaderRow: true })
            .run()
        }
      />
    </div>
  );
}
