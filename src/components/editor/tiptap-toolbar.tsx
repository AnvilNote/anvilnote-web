"use client";

import { useState, type ComponentType } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BarChart3,
  Bold,
  Check,
  ChevronDown,
  Code,
  Code2,
  Grid2x2,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  LineChart,
  Link2,
  List,
  ListOrdered,
  MessageCircleQuestion,
  MessageSquareWarning,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Sigma,
  SquareSigma,
  SquareAsterisk,
  Strikethrough,
  Table as TableIcon,
  Undo2,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableSizeGrid } from "@/components/editor/table-size-picker";
import { pickAndInsertImage } from "@/lib/tiptap/image";
import { insertCallout } from "@/lib/tiptap/callout";
import { insertQuestion } from "@/lib/tiptap/question";
import { insertMermaid } from "@/lib/tiptap/mermaid";
import { insertFunctionPlot } from "@/lib/tiptap/function-plot";
import { insertStatsChart } from "@/lib/tiptap/stats-chart";
import { DEFAULT_CALLOUT_KIND } from "@/config/callouts";
import type {
  MathClickMode,
  TableAlign,
  TableVariant,
} from "@/lib/tiptap/extensions";

function ToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors md:size-8",
        "hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

// H1/H2/H3 merged into one dropdown (explicit ask — the toolbar was
// cramped) instead of three separate always-visible buttons. Trigger icon
// swaps to whichever level is currently active (or the plain "Heading"
// glyph when the selection is a paragraph/something else), same pattern
// as e.g. Google Docs' own style dropdown.
function HeadingDropdown({
  editor,
  active,
  labels,
}: {
  editor: Editor;
  active: { h1: boolean; h2: boolean; h3: boolean };
  labels: { heading1: string; heading2: string; heading3: string };
}) {
  const entries = [
    { level: 1 as const, icon: Heading1, label: labels.heading1, isActive: active.h1 },
    { level: 2 as const, icon: Heading2, label: labels.heading2, isActive: active.h2 },
    { level: 3 as const, icon: Heading3, label: labels.heading3, isActive: active.h3 },
  ];
  const activeEntry = entries.find((entry) => entry.isActive);
  const TriggerIcon = activeEntry?.icon ?? Heading;
  const isActive = Boolean(activeEntry);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={activeEntry?.label ?? "Heading"}
          title={activeEntry?.label ?? "Heading"}
          aria-pressed={isActive}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1 text-muted-foreground transition-colors md:h-8",
            "hover:bg-accent hover:text-foreground",
            isActive && "bg-accent text-foreground",
          )}
        >
          <TriggerIcon className="size-4" />
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {entries.map(({ level, icon: Icon, label, isActive: entryActive }) => (
          <DropdownMenuItem
            key={level}
            onSelect={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <Icon className="size-4" />
            {label}
            <Check className={cn("ml-auto size-4", entryActive ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Inline/block math merged into one dropdown — same treatment as
// HeadingDropdown above (explicit ask, same "toolbar was cramped"
// rationale). Unlike Heading, selecting an entry doesn't apply a mark
// directly; it opens the math dialog seeded for that mode (onInsertMath),
// matching how the two separate buttons behaved before merging.
function MathDropdown({
  active,
  labels,
  onInsertMath,
}: {
  active: { inlineMath: boolean; blockMath: boolean };
  labels: { inlineMath: string; blockMath: string };
  onInsertMath: (mode: MathClickMode) => void;
}) {
  const entries = [
    { mode: "inline" as const, icon: Sigma, label: labels.inlineMath, isActive: active.inlineMath },
    { mode: "block" as const, icon: SquareSigma, label: labels.blockMath, isActive: active.blockMath },
  ];
  const activeEntry = entries.find((entry) => entry.isActive);
  const TriggerIcon = activeEntry?.icon ?? Sigma;
  const isActive = Boolean(activeEntry);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={activeEntry?.label ?? labels.inlineMath}
          aria-pressed={isActive}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1 text-muted-foreground transition-colors md:h-8",
            "hover:bg-accent hover:text-foreground",
            isActive && "bg-accent text-foreground",
          )}
          title={activeEntry?.label ?? labels.inlineMath}
          type="button"
        >
          <TriggerIcon className="size-4" />
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {entries.map(({ mode, icon: Icon, label, isActive: entryActive }) => (
          <DropdownMenuItem key={mode} onSelect={() => onInsertMath(mode)}>
            <Icon className="size-4" />
            {label}
            <Check className={cn("ml-auto size-4", entryActive ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border md:mx-1" />;
}

// Table button: instead of inserting a fixed size, it opens a hover grid so the
// user picks the dimensions first. Shares TableSizeGrid with the slash command.
function TableSizePicker({
  label,
  onPick,
}: {
  label: string;
  onPick: (rows: number, cols: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors md:size-8",
            "hover:bg-accent hover:text-foreground",
            open && "bg-accent text-foreground",
          )}
        >
          <TableIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <TableSizeGrid
          label={label}
          onPick={(rows, cols) => {
            onPick(rows, cols);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function TiptapToolbar({
  editor,
  onInsertMath,
  onEditLink,
  onImageError,
}: {
  editor: Editor;
  onInsertMath: (mode: MathClickMode) => void;
  onEditLink: () => void;
  onImageError: (kind: "unsupported" | "pdfRenderFailed") => void;
}) {
  const t = useTranslations("editor.toolbar");
  const tCallout = useTranslations("editor.callout");

  // Snapshot the marks/nodes relevant to the toolbar so it re-renders on every
  // selection or content change without re-rendering the editor surface.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive("paragraph"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      callout: e.isActive("callout"),
      question: e.isActive("question"),
      mermaid: e.isActive("mermaid"),
      functionPlot: e.isActive("functionPlot"),
      statsChart: e.isActive("statsChart"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      inlineMath: e.isActive("inlineMath"),
      blockMath: e.isActive("blockMath"),
      inTable: e.isActive("table"),
      tableVariant: (e.getAttributes("table").variant ?? "normal") as TableVariant,
      tableAlign: (e.getAttributes("table").align ?? "center") as TableAlign,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  function setTableVariant(variant: TableVariant) {
    editor.chain().focus().updateAttributes("table", { variant }).run();
  }

  function setTableAlign(align: TableAlign) {
    editor.chain().focus().updateAttributes("table", { align }).run();
  }

  return (
    <div data-tour="toolbar" className="flex items-center gap-0.5 overflow-x-auto pb-1 [overflow-anchor:none] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div data-tour-toolbar-group="0" className="flex items-center gap-0.5">
        <ToolbarButton
          icon={Pilcrow}
          label={t("paragraph")}
          active={s.paragraph}
          onClick={() => editor.chain().focus().setParagraph().run()}
        />
        <HeadingDropdown
          editor={editor}
          active={{ h1: s.h1, h2: s.h2, h3: s.h3 }}
          labels={{ heading1: t("heading1"), heading2: t("heading2"), heading3: t("heading3") }}
        />
      </div>

      <Divider />

      <div data-tour-toolbar-group="1" className="flex items-center gap-0.5">
        <ToolbarButton
          icon={Bold}
          label={t("bold")}
          active={s.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label={t("italic")}
          active={s.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={SquareAsterisk}
          label={t("footnote")}
          onClick={() => editor.chain().focus().addFootnote().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label={t("strike")}
          active={s.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          icon={Code}
          label={t("code")}
          active={s.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
      </div>

      <Divider />

      <div data-tour-toolbar-group="2" className="flex items-center gap-0.5">
        <ToolbarButton
          icon={List}
          label={t("bulletList")}
          active={s.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label={t("orderedList")}
          active={s.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </div>

      <Divider />

      <div data-tour-toolbar-group="3" className="flex items-center gap-0.5">
        <ToolbarButton
          icon={Quote}
          label={t("blockquote")}
          active={s.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={MessageSquareWarning}
          label={t("callout")}
          active={s.callout}
          onClick={() =>
            insertCallout(
              editor,
              DEFAULT_CALLOUT_KIND,
              tCallout(`kinds.${DEFAULT_CALLOUT_KIND}` as never),
            )
          }
        />
        <ToolbarButton
          icon={MessageCircleQuestion}
          label={t("questionBlock")}
          active={s.question}
          onClick={() => insertQuestion(editor)}
        />
        <ToolbarButton
          icon={Workflow}
          label={t("mermaid")}
          active={s.mermaid}
          onClick={() => insertMermaid(editor)}
        />
        {/* Hidden per explicit request: several math functions (ln, sqrt,
            log) crash the render when the default/a wide x-range includes
            values outside their domain, and the error surfaced to the user
            is unhelpfully generic ("check the formula syntax") rather than
            explaining the actual domain issue. Node type, dialog, and
            slash-command entry are all still intact — only these two entry
            points are removed — so this can be quickly re-enabled once
            that error messaging is improved.
        <ToolbarButton
          icon={LineChart}
          label={t("functionPlot")}
          active={s.functionPlot}
          onClick={() => insertFunctionPlot(editor)}
        /> */}
        <ToolbarButton
          icon={BarChart3}
          label={t("statsChart")}
          active={s.statsChart}
          onClick={() => insertStatsChart(editor)}
        />
        <ToolbarButton
          icon={Code2}
          label={t("codeBlock")}
          active={s.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        {/* <ToolbarButton
          icon={Link2}
          label={t("link")}
          active={s.link}
          onClick={onEditLink}
        /> */}
        <TableSizePicker
          label={t("table")}
          onPick={(rows, cols) =>
            editor
              .chain()
              .focus()
              .insertTable({ rows, cols, withHeaderRow: true })
              .run()
          }
        />
        <ToolbarButton
          icon={ImagePlus}
          label={t("image")}
          onClick={() => pickAndInsertImage(editor, onImageError)}
        />
      </div>

      <Divider />

      <div data-tour-toolbar-group="4" className="flex items-center gap-0.5">
        <MathDropdown
          active={{ inlineMath: s.inlineMath, blockMath: s.blockMath }}
          labels={{ inlineMath: t("inlineMath"), blockMath: t("blockMath") }}
          onInsertMath={onInsertMath}
        />
      </div>

      <Divider />

      <div data-tour-toolbar-group="5" className="flex items-center gap-0.5">
        <ToolbarButton
          icon={Undo2}
          label={t("undo")}
          disabled={!s.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={Redo2}
          label={t("redo")}
          disabled={!s.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      {s.inTable ? (
        <>
          <Divider />
          <ToolbarButton
            icon={Grid2x2}
            label={t("tableNormal")}
            active={s.tableVariant === "normal"}
            onClick={() => setTableVariant("normal")}
          />
          <ToolbarButton
            icon={Rows3}
            label={t("tableThreeLine")}
            active={s.tableVariant === "three-line"}
            onClick={() => setTableVariant("three-line")}
          />
          <Divider />
          <ToolbarButton
            icon={AlignLeft}
            label={t("tableAlignLeft")}
            active={s.tableAlign === "left"}
            onClick={() => setTableAlign("left")}
          />
          <ToolbarButton
            icon={AlignCenter}
            label={t("tableAlignCenter")}
            active={s.tableAlign === "center"}
            onClick={() => setTableAlign("center")}
          />
          <ToolbarButton
            icon={AlignRight}
            label={t("tableAlignRight")}
            active={s.tableAlign === "right"}
            onClick={() => setTableAlign("right")}
          />
        </>
      ) : null}
    </div>
  );
}
