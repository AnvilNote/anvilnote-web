"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorState } from "@tiptap/react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, Check, Code, Bold, Italic, Link2, Loader2, Send, Sigma, Strikethrough, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MathClickMode } from "@/lib/tiptap/extensions";
import { aiClient } from "@/lib/ai/runtime-client";
import { inlineAIErrorMessageKey } from "@/lib/ai/inline-error";
import {
  anvilNoteFragmentToTiptap,
  tiptapSelectionToAnvilNote,
  UnsupportedAIContentError,
} from "@/lib/ai/document/converters";
import { applyInlineAIContent } from "@/lib/ai/document/editor-operations";
import {
  clearInlineAIDiff,
  showInlineAIDiff,
} from "@/lib/ai/document/inline-diff";
import {
  useInlineAISelection,
  type InlineAISelectionRange,
} from "@/lib/ai/document/use-inline-ai-selection";
import {
  inlineReviewContent,
  inlineReviewText,
  isInlineReviewRangeActive,
  isPlainTextSelection,
  resolvePlainTextSelectionRange,
} from "@/lib/ai/document/inline-review";
import { ProtectedSelectionRegistry } from "@/lib/ai/document/protected-selection";
import { createSelectionSnapshot, hasSelectionConflict, type SelectionSnapshot } from "@/lib/ai/document/selection-snapshot";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useSmartModeUIStore } from "@/lib/stores/smart-mode-ui-store";

const FORMATTING_BUBBLE_PLUGIN_KEY = "anvilnote-formatting-bubble";
const INLINE_COMPOSER_MAX_HEIGHT_PX = 88;

function resizeInlineComposer(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const computedStyle = window.getComputedStyle(textarea);
  const verticalPadding =
    Number.parseFloat(computedStyle.paddingTop) + Number.parseFloat(computedStyle.paddingBottom);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
  const lineCount = Math.min(3, Math.max(1, Math.ceil((textarea.scrollHeight - verticalPadding) / lineHeight)));
  const nextHeight = Math.min(textarea.scrollHeight, INLINE_COMPOSER_MAX_HEIGHT_PX);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > INLINE_COMPOSER_MAX_HEIGHT_PX ? "auto" : "hidden";
  return lineCount;
}

function MenuButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

// The DOM serializes any style="color: #rrggbb" back as "rgb(r, g, b)", so
// getAttributes("textStyle").color returns the rgb() form for any color
// that round-tripped through parseHTML (e.g. after a reload) even though
// setColor() stored hex — normalize for display so the label always reads
// as hex.
function toHexColor(color: string): string {
  const match = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return color;
  return `#${match
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function TiptapBubbleMenu({
  editor,
  documentId,
  onInsertMath,
  onEditLink,
  onEditColor,
}: {
  editor: Editor;
  documentId?: string;
  onInsertMath: (mode: MathClickMode) => void;
  onEditLink: () => void;
  onEditColor: () => void;
}) {
  const t = useTranslations("editor.toolbar");
  const tBlock = useTranslations("editor.block");
  const tSmart = useTranslations("ai");
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      color: e.getAttributes("textStyle").color as string | undefined,
    }),
  });
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineInstruction, setInlineInstruction] = useState("");
  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineComposerLineCount, setInlineComposerLineCount] = useState(1);
  const [inlineSelectionRange, setInlineSelectionRange] = useState<InlineAISelectionRange | null>(null);
  const inlineComposerRef = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<{
    inlineContent: JSONContent[];
    snapshot: SelectionSnapshot;
  } | null>(null);
  const pendingRef = useRef<typeof pending>(null);
  const locale = useLocale();
  const settings = useSettingsStore();
  const activeConversationId = useSmartModeUIStore((state) =>
    documentId ? state.activeConversationByDocument[documentId] ?? null : null,
  );
  const setActiveConversation = useSmartModeUIStore((state) => state.setActiveConversation);
  const smartModeOpen = useSmartModeUIStore((state) => state.open);
  const notifyConversationChanged = useSmartModeUIStore((state) => state.notifyConversationChanged);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (inlineOpen && inlineComposerRef.current) {
      setInlineComposerLineCount(resizeInlineComposer(inlineComposerRef.current));
    } else {
      setInlineComposerLineCount(1);
    }
  }, [inlineInstruction, inlineOpen]);

  useInlineAISelection(editor, {
    open: inlineOpen,
    pending: pending !== null,
    range: inlineSelectionRange,
  });

  useEffect(() => {
    if (!smartModeOpen && pendingRef.current) {
      clearInlineAIDiff(editor);
      setPending(null);
    }
  }, [editor, smartModeOpen]);

  useEffect(() => {
    const clearOnDocumentChange = () => {
      if (pendingRef.current) {
        clearInlineAIDiff(editor);
        setPending(null);
      }
    };
    editor.on("update", clearOnDocumentChange);
    return () => {
      editor.off("update", clearOnDocumentChange);
      clearInlineAIDiff(editor);
    };
  }, [editor]);

  useEffect(() => {
    const clearOnSelectionChange = () => {
      const current = pendingRef.current;
      if (!current) return;
      const { from, to } = editor.state.selection;
      if (!isInlineReviewRangeActive(current.snapshot, { from, to })) {
        clearInlineAIDiff(editor);
        setPending(null);
      }
    };
    editor.on("selectionUpdate", clearOnSelectionChange);
    return () => {
      editor.off("selectionUpdate", clearOnSelectionChange);
    };
  }, [editor]);

  async function submitInline() {
    if (!documentId || !inlineInstruction.trim() || inlineBusy) return;
    const { from, to } = inlineSelectionRange ?? editor.state.selection;
    if (!isPlainTextSelection(editor, from, to)) {
      setInlineError("ai.errors.unsupported_selection");
      return;
    }
    const requestId = crypto.randomUUID();
    const content = editor.state.doc.slice(from, to).content.toJSON();
    const registry = ProtectedSelectionRegistry.create();
    try {
      setInlineBusy(true);
      setInlineError(null);
      const selectedContent = tiptapSelectionToAnvilNote(content, registry);
      const snapshot = createSelectionSnapshot({
        requestId,
        documentId,
        from,
        to,
        document: editor.getJSON(),
        selectedContent: content,
      });
      const completed = await aiClient.executeConversationTurn(documentId, {
        requestId,
        ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        provider: { id: "openai", model: settings.aiModelId },
        instruction: inlineInstruction.trim(),
        context: {
          locale,
          writingStyle: settings.aiWritingStyle,
          selectedContent,
        },
        options: { humanizerEnabled: settings.aiHumanizerEnabled },
      });
      const assistant = completed.messages[1];
      if (assistant.draft?.kind !== "rewrite-selection") {
        throw new Error("invalid_structured_output");
      }
      setActiveConversation(documentId, completed.conversation.id);
      notifyConversationChanged();
      if (
        snapshot.to > editor.state.doc.content.size ||
        hasSelectionConflict(snapshot, {
          document: editor.getJSON(),
          selectedContent: editor.state.doc.slice(snapshot.from, snapshot.to).content.toJSON() as JSONContent[],
        })
      ) {
        throw new Error("selection_conflict");
      }
      const inlineContent = inlineReviewContent(
        anvilNoteFragmentToTiptap(assistant.draft.replacement, registry),
      );
      if (!inlineContent) {
        setInlineError("ai.errors.unsupported_selection");
        return;
      }
      showInlineAIDiff(editor, {
        from,
        to,
        replacementText: inlineReviewText(inlineContent),
      });
      setPending({ inlineContent, snapshot });
      setInlineSelectionRange(null);
      setInlineOpen(false);
      // The turn is saved server-side, and the right panel is the durable
      // conversation view. Keep the temporary review beside the text without
      // interrupting the person by opening that panel automatically.
    } catch (error) {
      if (error instanceof UnsupportedAIContentError) {
        // An inline action never opens the conversation panel on the person's
        // behalf. Keep the exact selection and composer in place so they can
        // adjust or cancel without losing context.
        setInlineError("ai.errors.unsupported_selection");
        return;
      }
      setInlineError(inlineAIErrorMessageKey(error));
    } finally {
      setInlineBusy(false);
    }
  }

  function rejectInline() {
    if (!pending) return;
    const { from, to } = pending.snapshot;
    clearInlineAIDiff(editor);
    setPending(null);
    setInlineSelectionRange({ from, to });
    setInlineError(null);
    setInlineOpen(true);
  }

  function acceptInline() {
    if (!pending) return;
    const snapshot = pending.snapshot;
    try {
      if (snapshot.to > editor.state.doc.content.size || hasSelectionConflict(snapshot, {
        document: editor.getJSON(),
        selectedContent: editor.state.doc.slice(snapshot.from, snapshot.to).content.toJSON(),
      })) throw new Error("selection_conflict");
      clearInlineAIDiff(editor);
      if (!applyInlineAIContent(editor, { from: snapshot.from, to: snapshot.to }, pending.inlineContent)) {
        throw new Error("conversion_failed");
      }
      setPending(null);
      setInlineSelectionRange(null);
      setInlineInstruction("");
      setInlineError(null);
      setInlineOpen(false);
      // Return DOM focus to ProseMirror after the review button disappears.
      // This synchronizes the collapsed TextSelection to the native browser
      // selection so the accepted range cannot remain visibly highlighted.
      window.requestAnimationFrame(() => editor.view.focus());
    } catch (error) {
      // A changed document or a failed conversion can no longer safely use
      // this anchored proposal. It is only a view decoration, so discard it
      // rather than leaving an unreachable/stale Accept control behind.
      clearInlineAIDiff(editor);
      setPending(null);
      setInlineSelectionRange({ from: snapshot.from, to: snapshot.to });
      setInlineOpen(true);
      setInlineError(inlineAIErrorMessageKey(error));
    }
  }

  return (
    <>
      <BubbleMenu
      editor={editor}
      pluginKey={FORMATTING_BUBBLE_PLUGIN_KEY}
      options={inlineOpen || pending ? { placement: "top", offset: 12, flip: true, shift: { padding: 12 } } : undefined}
      className={pending
        ? "z-30 flex items-center gap-2 rounded-2xl border bg-popover p-2 shadow-lg"
        : inlineOpen
        ? cn(
          "relative z-30 flex w-[min(34rem,calc(100vw-2rem))] items-start gap-2 border bg-popover px-3 py-1 shadow-md",
          inlineComposerLineCount === 1
            ? "rounded-full"
            : inlineComposerLineCount === 2
              ? "rounded-2xl"
              : "rounded-xl",
        )
        : "z-20 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"}
      shouldShow={({ editor: e, from, to }) =>
        from !== to &&
        !(e.state.selection instanceof CellSelection) &&
        !e.isActive("codeBlock") &&
        !e.isActive("blockMath") &&
        !e.isActive("horizontalRule")
      }
    >
      {pending ? <>
        <span className="px-1 text-xs text-muted-foreground">{tSmart("smart.reviewResult")}</span>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2 text-xs text-primary-foreground" onMouseDown={(event) => event.preventDefault()} onClick={acceptInline}><Check className="size-3.5" />{tSmart("smart.accept")}</button>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={rejectInline}><X className="size-3.5" />{tSmart("smart.reject")}</button>
      </> : inlineOpen ? <>
        <textarea
          autoFocus
          ref={inlineComposerRef}
          rows={1}
          value={inlineInstruction}
          placeholder={tSmart("smart.inlinePlaceholder")}
          className="h-10 min-h-10 max-h-[5.5rem] flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 leading-6 text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setInlineComposerLineCount(resizeInlineComposer(event.currentTarget));
            setInlineInstruction(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              clearInlineAIDiff(editor);
              setInlineSelectionRange(null);
              setInlineOpen(false);
              setInlineError(null);
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submitInline();
            }
          }}
        />
        <button type="button" className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" disabled={!inlineInstruction.trim() || inlineBusy} aria-label={tSmart("smart.rewrite")} onMouseDown={(event) => event.preventDefault()} onClick={() => void submitInline()}>{inlineBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button>
        {inlineError ? <p className="absolute left-3 top-full mt-1 max-w-[calc(100%-1.5rem)] rounded-lg border border-destructive/30 bg-popover px-2 py-1 text-xs text-destructive shadow-sm" role="alert">{tSmart(inlineError.replace(/^ai\./, "") as never)}</p> : null}
      </> : <>
      <MenuButton
        icon={Bold}
        label={t("bold")}
        active={s.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      {documentId ? <MenuButton
        icon={Bot}
        label={tSmart("smart.inline")}
        active={inlineOpen}
        onClick={() => {
          setInlineError(null);
          const { from, to } = editor.state.selection;
          const range = resolvePlainTextSelectionRange(editor, from, to);
          if (!range) {
            setInlineSelectionRange(null);
            setInlineOpen(false);
            return;
          }
          setInlineSelectionRange(range);
          setInlineOpen(true);
        }}
      /> : null}
      <MenuButton
        icon={Italic}
        label={t("italic")}
        active={s.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <MenuButton
        icon={Strikethrough}
        label={t("strike")}
        active={s.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <MenuButton
        icon={Code}
        label={t("code")}
        active={s.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <MenuButton
        icon={Link2}
        label={t("link")}
        active={s.link}
        onClick={onEditLink}
      />
      <MenuButton
        icon={Sigma}
        label={t("inlineMath")}
        onClick={() => {
          // The bubble menu only shows while there's a real, non-empty
          // selection (its own shouldShow requires from !== to), so marking
          // text and clicking this is a request to turn exactly that text
          // into its LaTeX source directly — skip the empty-dialog
          // round-trip and convert in place. Falls back to the dialog only
          // for the edge case of a whitespace-only selection.
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, " ").trim();
          if (!text) {
            onInsertMath("inline");
            return;
          }
          editor.chain().focus().deleteSelection().insertInlineMath({ latex: text }).run();
        }}
      />
      <span className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        title={tBlock("color")}
        aria-label={tBlock("color")}
        onClick={onEditColor}
        className="inline-flex h-7 items-center gap-1.5 rounded px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span
          className="size-3.5 shrink-0 rounded-full border"
          style={{ backgroundColor: s.color ?? "#000000" }}
        />
        <span className="font-mono text-xs">
          {s.color ? toHexColor(s.color) : tBlock("colors.default")}
        </span>
      </button>
      </>}
      </BubbleMenu>
    </>
  );
}
