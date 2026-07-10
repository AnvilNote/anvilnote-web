"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { ChainedCommands, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import {
  Code2,
  FileText,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Save,
  FileDown,
  ImagePlus as ImageIcon,
  LayoutTemplate,
  List,
  ListOrdered,
  PanelLeft,
  Plus,
  Quote,
  Search,
  Settings,
  Sigma,
  SquareSigma,
  Table as TableIcon,
  Type,
} from "lucide-react";
import { DocumentTitle } from "@/components/editor/document-title";
import {
  MathEditorDialog,
  CLOSED_MATH_DIALOG,
  type MathDialogState,
} from "@/components/editor/math-editor-dialog";
import { LinkInput } from "@/components/editor/link-input";
import { TextColorPicker } from "@/components/editor/text-color-picker";
import { TiptapBubbleMenu } from "@/components/editor/tiptap-bubble-menu";
import { TiptapToolbar } from "@/components/editor/tiptap-toolbar";
import { BlockHandle } from "@/components/editor/block-handle";
import { TableSizeDialog } from "@/components/editor/table-size-picker";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import {
  createSlashCommand,
  type SlashItem,
} from "@/components/editor/slash-command-menu";
import { Button } from "@/components/ui/button";
import { AutosaveIndicatorView, type SaveStatus } from "@/components/editor/autosave-indicator";
import { buildExtensions, type MathClickMode } from "@/lib/tiptap/extensions";
import { pickAndInsertImage } from "@/lib/tiptap/image";
import {
  deleteBlockMath,
  deleteInlineMath,
  insertBlockMath,
  insertInlineMath,
  updateBlockMath,
  updateInlineMath,
} from "@/lib/tiptap/math";
import { extractOutline } from "@/lib/tiptap/serialization";
import { cn } from "@/lib/utils";

type DemoCopy = {
  search: string;
  documents: string;
  currentLabel: string;
  appName: string;
  documentsNav: string;
  templates: string;
  settings: string;
  save: string;
  export: string;
  exportDisabled: string;
  outline: string;
  metadata: string;
  template: string;
  exportTab: string;
  starterTitle: string;
};

const demoSeedContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "AnvilNote Feature Tour" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "The quick brown fox jumps over the lazy dog while this page demonstrates ",
        },
        { type: "text", marks: [{ type: "bold" }], text: "bold" },
        { type: "text", text: ", " },
        { type: "text", marks: [{ type: "italic" }], text: "italic" },
        { type: "text", text: ", " },
        { type: "text", marks: [{ type: "strike" }], text: "strikethrough" },
        { type: "text", text: ", and " },
        { type: "text", marks: [{ type: "code" }], text: "inline code" },
        { type: "text", text: " in one editable note." },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Structured Sections" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Use headings, blocks, and reusable structure to keep long notes readable from first draft to final export.",
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Unordered lists are good for loose observations and raw ideas" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "You can mix plain writing with richer content without leaving the editor" }],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Capture the idea" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Shape it into sections" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Export when the draft is ready" }],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Media, Math, and Tables" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Inline math also works, for example " },
        {
          type: "inlineMath",
          attrs: { latex: "e^{i\\pi}+1=0" },
        },
        { type: "text", text: ", right inside a sentence." },
      ],
    },
    {
      type: "blockMath",
      attrs: { latex: "\\int_0^1 x^2\\,dx = \\frac{1}{3}" },
    },
    {
      type: "image",
      attrs: {
        src: "/landing/demo-quill.png",
        alt: "AnvilNote feather mark",
        title: "AnvilNote feather mark",
        caption: "Image Caption",
        width: 72,
        align: "center",
      },
    },
    {
      type: "table",
      attrs: {
        caption: "Table Caption",
        variant: "normal",
        align: "center",
      },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Block" }] }],
            },
            {
              type: "tableHeader",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Use" }] }],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Heading" }] }],
            },
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Organize the note" }] }],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Math" }] }],
            },
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Render equations directly" }] }],
            },
          ],
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [
        {
          type: "text",
          text: "const note = {\n  title: 'AnvilNote Feature Tour',\n  localFirst: true,\n};",
        },
      ],
    },
  ],
};

function SidebarRow({
  icon: Icon,
  label,
  active = false,
  collapsed = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground/78",
        collapsed && "justify-center",
        active && "bg-accent font-medium text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </div>
  );
}

export function LandingDemoEditor({ copy }: { copy: DemoCopy }) {
  const t = useTranslations();
  const tt = useTranslations("editor.slash");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [title, setTitle] = useState(copy.starterTitle);
  const [content, setContent] = useState<JSONContent>(structuredClone(demoSeedContent));
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [mathDialog, setMathDialog] = useState<MathDialogState>(CLOSED_MATH_DIALOG);
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMathClick = useCallback(
    (mode: MathClickMode, pos: number, latex: string, refName?: string) => {
      setMathDialog({ open: true, mode, pos, latex, refName });
    },
    [],
  );

  const requestMath = useCallback((mode: MathClickMode) => {
    setMathDialog({ open: true, mode, pos: null, latex: "" });
  }, []);

  const requestTable = useCallback(() => setTableDialogOpen(true), []);

  const extensions = useMemo(
    () =>
      buildExtensions({
        placeholder: t("editor.writePlaceholder"),
        figureLabel: t("editor.image.figure"),
        tableLabel: t("editor.table.figure"),
        figureCaptionPlaceholder: t("editor.image.captionPlaceholder"),
        tableCaptionPlaceholder: t("editor.table.captionPlaceholder"),
        tableDeleteLabel: t("editor.block.delete", { type: t("editor.block.types.table") }),
        questionBodyPlaceholder: t("editor.questionBlock.bodyPlaceholder"),
        choicePlaceholder: (label: string) => t("editor.questionBlock.choicePlaceholder", { label }),
        onMathClick: handleMathClick,
      }),
    [handleMathClick, t],
  );

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
          pickAndInsertImage(editor);
        },
      },
      {
        title: tt("inlineMath"),
        subtitle: tt("inlineMathHint"),
        icon: Sigma,
        aliases: ["x", "inline math", "latex", "公式"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          requestMath("inline");
        },
      },
      {
        title: tt("blockMath"),
        subtitle: tt("blockMathHint"),
        icon: SquareSigma,
        aliases: ["d", "display", "equation", "區塊公式"],
        run: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          requestMath("block");
        },
      },
    ];
  }, [requestMath, requestTable, tt]);

  const slashCommand = useMemo(
    () => createSlashCommand(() => slashItems),
    [slashItems],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...extensions, slashCommand],
    content,
    editorProps: {
      attributes: { class: "anvil-prose focus:outline-none" },
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement | null)?.closest?.("a");
        const href = anchor?.getAttribute("href");
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      setContent(e.getJSON());
      setStatus("saving");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setStatus("saved"), 450);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const outline = useMemo(() => extractOutline(content), [content]);

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
    <div className="landing-demo overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_80px_-48px_rgba(0,0,0,0.38)]">
      <div
        className="grid h-[760px] min-h-0"
        style={{
          gridTemplateColumns: sidebarCollapsed
            ? "3.5rem minmax(0,1fr)"
            : "15rem minmax(0,1fr)",
        }}
      >
        <aside className="border-r border-border bg-sidebar">
          <div
            className={cn(
              "flex h-16 items-center",
              sidebarCollapsed ? "justify-center px-2" : "gap-3 px-5",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md">
              <Image
                src="/favicon-dark.svg"
                alt=""
                aria-hidden="true"
                width={28}
                height={28}
                className="size-7"
              />
            </span>
            {!sidebarCollapsed ? (
              <span className="text-[15px] font-semibold tracking-tight">AnvilNote</span>
            ) : null}
          </div>

          {!sidebarCollapsed ? (
            <div className="px-3 pt-0 pb-1">
              <div className="flex h-9 items-center gap-3 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground shadow-none">
                <Search className="size-4.5 shrink-0" />
                <span className="flex-1 text-left">{copy.search}</span>
                <kbd className="pointer-events-none rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </div>
            </div>
          ) : null}

          <div className={cn("px-1 pt-0 pb-2", sidebarCollapsed && "px-0")}>
            <div
              className={cn(
                "relative flex h-8 items-center text-xs font-medium text-foreground/70",
                sidebarCollapsed ? "justify-center px-0" : "px-3",
              )}
            >
              {!sidebarCollapsed ? <span>{copy.documents}</span> : null}
              <Plus
                className={cn(
                  "size-4.5 text-foreground/80",
                  sidebarCollapsed ? "static" : "absolute right-3",
                )}
              />
            </div>

            <div className="space-y-1 px-2">
              <SidebarRow
                icon={FileText}
                label={title || copy.currentLabel}
                active
                collapsed={sidebarCollapsed}
              />
            </div>

            <div className="mt-3 space-y-1 px-2">
              {!sidebarCollapsed ? (
                <div className="flex h-8 items-center px-2 text-xs font-medium text-foreground/70">
                  {copy.appName}
                </div>
              ) : null}
              <SidebarRow
                icon={FileText}
                label={copy.documentsNav}
                collapsed={sidebarCollapsed}
              />
              <SidebarRow
                icon={LayoutTemplate}
                label={copy.templates}
                collapsed={sidebarCollapsed}
              />
              <SidebarRow
                icon={Settings}
                label={copy.settings}
                collapsed={sidebarCollapsed}
              />
            </div>
          </div>

        </aside>

        <div className="grid min-w-0 min-h-0 grid-rows-[3.5rem_3rem_minmax(0,1fr)]">
          <div className="flex items-center justify-between border-b border-border px-4 lg:px-5">
            <button
              type="button"
              aria-label="Toggle sidebar"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
            >
              <PanelLeft className="size-4" />
            </button>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <LocaleSwitcher />
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl border-border bg-background px-3.5 text-sm font-medium shadow-none"
              >
                <Save className="size-4.5" />
                {copy.save}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-xl bg-foreground px-3.5 text-sm font-medium text-background shadow-none hover:bg-foreground/90"
                disabled
                title={copy.exportDisabled}
              >
                <FileDown className="size-4.5" />
                {copy.export}
              </Button>
            </div>
          </div>

          <div className="border-b border-border px-3 py-1 lg:px-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 landing-demo-toolbar">
                {editor ? (
                  <TiptapToolbar
                    editor={editor}
                    onInsertMath={requestMath}
                    onEditLink={() => setLinkOpen(true)}
                    onImageError={() => {}}
                  />
                ) : null}
              </div>
              <div className="shrink-0">
                <AutosaveIndicatorView status={status} />
              </div>
            </div>
          </div>

          <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="min-w-0 min-h-0 overflow-y-auto">
              <div className="mx-auto w-full max-w-[820px] pl-12 pr-3 pb-2 pt-5 lg:pt-8">
                <DocumentTitle value={title} onChange={(value) => {
                  setTitle(value);
                  setStatus("unsaved");
                  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                  saveTimerRef.current = setTimeout(() => setStatus("saved"), 450);
                }} />
              </div>

              <div className="anvil-editor mx-auto w-full max-w-[820px] pl-12 pr-3 pb-24">
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
            </div>

            <aside className="hidden border-l border-border bg-muted/18 lg:block">
              <div className="border-b border-border p-3">
                <div className="grid grid-cols-[1fr_1.35fr_0.9fr_0.95fr] rounded-[1.7rem] bg-muted p-1 text-[0.92rem] leading-none">
                  <div className="rounded-[1.3rem] bg-background px-2 py-1.5 text-center font-medium whitespace-nowrap shadow-sm">
                    {copy.outline}
                  </div>
                  <div className="px-1 py-1.5 text-center text-muted-foreground whitespace-nowrap">
                    {copy.metadata}
                  </div>
                  <div className="px-1 py-1.5 text-center text-muted-foreground whitespace-nowrap">
                    {copy.template}
                  </div>
                  <div className="px-1 py-1.5 text-center text-muted-foreground whitespace-nowrap">
                    {copy.exportTab}
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="truncate">{title || copy.currentLabel}</span>
                </div>
                <div className="mt-5 space-y-2">
                  {outline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">/ to insert blocks</p>
                  ) : (
                    outline.map((item, index) => (
                      <div
                        key={`${item.text}-${index}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground"
                        style={{ paddingInlineStart: `${0.5 + (item.level - 1) * 0.85}rem` }}
                      >
                        <Hash className="size-3.5 shrink-0 opacity-50" />
                        <span className="truncate">{item.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
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
