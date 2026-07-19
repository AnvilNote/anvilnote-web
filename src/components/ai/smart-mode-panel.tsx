"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  MessageSquareMore,
  MessageSquarePlus,
  MessagesSquare,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { AttachmentContext, WritingStyle } from "@anvilnote/ai-writer/contracts";
import type { AnvilNoteDocumentFragmentV1 } from "@anvilnote/ai-writer/document";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AIDocumentPreview } from "./ai-document-preview";
import {
  AIClientError,
  aiClient,
  type AIConversation,
  type AIConversationAttachment,
  type AIConversationDraft,
  type AIConversationMessage,
  type AIConversationTurnRequest,
  type AIProviderMetadata,
  type PreparedAIConversationAttachment,
  type AISecretStatus,
} from "@/lib/ai/runtime-client";
import {
  anvilNoteDocumentToTiptap,
  anvilNoteFragmentToTiptap,
  tiptapSelectionToAnvilNote,
  UnsupportedAIContentError,
} from "@/lib/ai/document/converters";
import { applyAIContent } from "@/lib/ai/document/editor-operations";
import { ProtectedSelectionRegistry } from "@/lib/ai/document/protected-selection";
import {
  createSelectionSnapshot,
  hasSelectionConflict,
  stableDocumentHash,
  type SelectionSnapshot,
} from "@/lib/ai/document/selection-snapshot";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useSmartModeUIStore } from "@/lib/stores/smart-mode-ui-store";

const MAX_INSTRUCTION_CHARACTERS = 6_000;
const ACCEPTED_EXTENSIONS = new Set(["txt", "md", "markdown", "pdf", "docx"]);

type SmartModeState = "ready" | "extracting" | "submitting" | "error" | "cancelled";

interface AttachmentItem {
  file: File;
  status: "extracting" | "ready" | "warning" | "error";
  context?: AttachmentContext;
  errorKey?: string;
  prepared?: PreparedAIConversationAttachment;
}

const COMPOSER_LINE_HEIGHT = 24;
const COMPOSER_VERTICAL_PADDING = 16;
const MAX_COMPOSER_LINES = 10;
const MAX_COMPOSER_HEIGHT =
  COMPOSER_LINE_HEIGHT * MAX_COMPOSER_LINES + COMPOSER_VERTICAL_PADDING;

function composerRadius(lines: number): string {
  if (lines <= 1) return "rounded-full";
  if (lines <= 3) return "rounded-2xl";
  if (lines <= 6) return "rounded-xl";
  return "rounded-lg";
}

function UserMessage({ message }: { message: AIConversationMessage }) {
  const t = useTranslations("ai");
  const visibleAttachments = message.attachments?.slice(0, 2) ?? [];
  const hiddenAttachmentCount = Math.max(
    0,
    (message.attachments?.length ?? 0) - visibleAttachments.length,
  );

  return (
    <div className="ml-auto w-fit max-w-full">
      <div className="relative w-fit max-w-full rounded-2xl rounded-br-md bg-primary py-2 pl-3 pr-10 text-sm text-primary-foreground">
        <p className="max-w-[20em] whitespace-pre-wrap break-words">{message.content}</p>
        <button
          type="button"
          className="absolute right-2 top-1.5 inline-flex size-6 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-primary-foreground/10 hover:opacity-100"
          aria-label={t("smart.copyMessage")}
          onClick={() => {
            void navigator.clipboard.writeText(message.content).then(() => {
              toast.success(t("smart.messageCopied"));
            }).catch(() => undefined);
          }}
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      {visibleAttachments.length ? (
        <div className="mt-1 flex max-w-full items-center justify-end gap-1 overflow-hidden">
          {visibleAttachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex min-w-0 max-w-28 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-foreground"
              title={attachment.originalName}
            >
              <FileText className="size-3 shrink-0" />
              <span className="truncate">{attachment.originalName}</span>
            </span>
          ))}
          {hiddenAttachmentCount ? (
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-foreground"
              aria-label={t("smart.moreAttachments", { count: hiddenAttachmentCount })}
            >
              +{hiddenAttachmentCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SelectionInfo {
  from: number;
  to: number;
  content: JSONContent[];
  text: string;
}

interface DraftOperation {
  registry: ProtectedSelectionRegistry | null;
  selectionSnapshot: SelectionSnapshot | null;
  cursor: { position: number; documentHash: string } | null;
  documentHash: string;
}

function selectedContent(
  editor: NonNullable<ReturnType<typeof useEditorBridge.getState>["editor"]>,
): SelectionInfo | null {
  const { from, to } = editor.state.selection;
  if (from === to) return null;
  const content = editor.state.doc.slice(from, to).content.toJSON() as JSONContent[];
  const text = editor.state.doc.textBetween(from, to, "\n");
  return text.trim() ? { from, to, content, text } : null;
}

function errorKey(error: unknown): string {
  if (error instanceof UnsupportedAIContentError) return "ai.errors.unsupported_selection";
  if (error instanceof AIClientError) return error.shape.messageKey;
  if (error instanceof DOMException && error.name === "AbortError") {
    return "ai.errors.request_cancelled";
  }
  if (error instanceof Error && ["selection_conflict", "conversion_failed", "editor_unavailable"].includes(error.message)) {
    return `ai.errors.${error.message}`;
  }
  return "ai.errors.unknown_error";
}

function draftContent(draft: AIConversationDraft) {
  return draft.kind === "compose"
    ? anvilNoteDocumentToTiptap(draft.document).content ?? []
    : anvilNoteFragmentToTiptap(draft.replacement, ProtectedSelectionRegistry.create());
}

function draftTitle(draft: AIConversationDraft): string | null {
  return draft.kind === "compose" ? draft.suggestedTitle : null;
}

function DraftCard({
  message,
  operation,
  onInsert,
  onReplace,
  disabled,
}: {
  message: AIConversationMessage;
  operation: DraftOperation | undefined;
  onInsert: (message: AIConversationMessage) => void;
  onReplace: (message: AIConversationMessage) => void;
  disabled: boolean;
}) {
  const t = useTranslations("ai");
  if (!message.draft) return null;
  const { draft } = message;
  const canApplySelectionRewrite = Boolean(
    operation?.selectionSnapshot && operation.registry,
  );
  const canInsert = draft.kind === "compose" ? Boolean(operation) : canApplySelectionRewrite;
  const canReplaceWholeDocument = draft.kind === "compose" && Boolean(operation);
  return (
    <article className="mt-2 overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
      <div className="max-h-56 overflow-y-auto p-3">
        {draft.kind === "compose" ? <AIDocumentPreview document={draft.document} /> : <AIDocumentPreview document={draft.replacement} />}
      </div>
      <div className="border-t bg-muted/35 px-3 py-2">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {draft.kind === "compose" ? draft.summary : draft.changeSummary}
        </p>
        {canInsert || canReplaceWholeDocument ? <div className="mt-2 flex flex-wrap justify-end gap-2">
          {canInsert ? <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onInsert(message)}>
            {draft.kind === "rewrite-selection" ? t("smart.accept") : t("smart.insertAtCursor")}
          </Button> : null}
          {canReplaceWholeDocument ? <Button size="sm" disabled={disabled} onClick={() => onReplace(message)}>
            {t("smart.replaceWholeDocument")}
          </Button> : null}
        </div> : null}
      </div>
    </article>
  );
}

export function SmartModePanel({
  open,
}: {
  open: boolean;
}) {
  const t = useTranslations("ai");
  const locale = useLocale();
  const router = useRouter();
  const editor = useEditorBridge((state) => state.editor);
  const documentId = useEditorBridge((state) => state.documentId);
  const settings = useSettingsStore();
  const snapshotBeforeAIInsert = useDocumentStore((state) => state.snapshotBeforeAIInsert);
  const replaceWholeDocumentFromAI = useDocumentStore((state) => state.replaceWholeDocumentFromAI);
  const activeConversationId = useSmartModeUIStore((state) =>
    documentId ? state.activeConversationByDocument[documentId] ?? null : null,
  );
  const setActiveConversation = useSmartModeUIStore((state) => state.setActiveConversation);
  const notifyConversationChanged = useSmartModeUIStore((state) => state.notifyConversationChanged);
  const inlineFallbackInstruction = useSmartModeUIStore((state) =>
    documentId ? state.inlineFallbackInstructionByDocument[documentId] : undefined,
  );
  const setInlineFallbackInstruction = useSmartModeUIStore((state) => state.setInlineFallbackInstruction);
  const conversationVersion = useSmartModeUIStore((state) => state.conversationVersion);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const compositionJustEndedRef = useRef(false);
  const compositionEndTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const renameComposingRef = useRef(false);
  const renameCompositionJustEndedRef = useRef(false);
  const renameCompositionEndTimerRef = useRef<number | null>(null);
  const renamePendingRef = useRef(false);
  const applyingDraftsRef = useRef<Set<string>>(new Set());
  const [operations, setOperations] = useState<Map<string, DraftOperation>>(() => new Map());
  const initialConversationSelectionRef = useRef<string | null>(null);
  const currentDocumentIdRef = useRef(documentId);

  const [state, setState] = useState<SmartModeState>("ready");
  const [instruction, setInstruction] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [metadata, setMetadata] = useState<AIProviderMetadata | null>(null);
  const [credential, setCredential] = useState<AISecretStatus | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIConversationMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [renamingConversation, setRenamingConversation] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [conversationSelectOpen, setConversationSelectOpen] = useState(false);
  const [writingStyleOpen, setWritingStyleOpen] = useState(false);
  const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);
  const [selectionState, setSelectionState] = useState<SelectionInfo | null>(() =>
    editor ? selectedContent(editor) : null,
  );
  const [composerLines, setComposerLines] = useState(1);

  const readyAttachments = useMemo(
    () => attachments.flatMap((item) => (item.context ? [item.context] : [])),
    [attachments],
  );
  const attachmentBusy = attachments.some((item) => item.status === "extracting");
  const attachmentError = attachments.some((item) => item.status === "error");
  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null;

  const captureSelection = useCallback(() => {
    setSelectionState(editor ? selectedContent(editor) : null);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("selectionUpdate", captureSelection);
    return () => {
      editor.off("selectionUpdate", captureSelection);
    };
  }, [captureSelection, editor]);

  useEffect(() => {
    currentDocumentIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => () => {
    if (renameCompositionEndTimerRef.current !== null) {
      window.clearTimeout(renameCompositionEndTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!documentId || !inlineFallbackInstruction) return;
    const timer = window.setTimeout(() => {
      setInstruction(inlineFallbackInstruction);
      setInlineFallbackInstruction(documentId, null);
      setErrorMessageKey("ai.errors.unsupported_selection");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [documentId, inlineFallbackInstruction, setInlineFallbackInstruction]);

  const loadConversations = useCallback(async (cursor?: string) => {
    if (!documentId) return;
    const page = await aiClient.listConversations(documentId, cursor);
    setConversations((current) => {
      const merged = cursor ? [...current, ...page.data] : page.data;
      return [...new Map(merged.map((item) => [item.id, item])).values()];
    });
    setConversationCursor(page.nextCursor);
    if (
      !cursor &&
      page.data.length &&
      !activeConversationId &&
      initialConversationSelectionRef.current !== documentId
    ) {
      initialConversationSelectionRef.current = documentId;
      setActiveConversation(documentId, page.data[0].id);
    }
  }, [activeConversationId, documentId, setActiveConversation]);

  const loadMessages = useCallback(async (conversationId: string, cursor?: string) => {
    if (!documentId) return;
    setMessagesLoading(true);
    try {
      const page = await aiClient.listConversationMessages(documentId, conversationId, cursor);
      setMessages((current) => (cursor ? [...page.data, ...current] : page.data));
      setMessageCursor(page.nextCursor);
      if (editor) {
        const hash = stableDocumentHash(editor.getJSON());
        for (const message of page.data) {
          // A persisted selection rewrite does not carry its original
          // protected-selection registry or exact range snapshot. Never
          // reconstruct one from current cursor state: historical rewrites
          // remain previewable, but only a still-live request may apply one.
          if (message.draft?.kind === "compose") {
            setOperations((current) => current.has(message.id) ? current : new Map(current).set(message.id, {
              registry: null,
              selectionSnapshot: null,
              cursor: { position: editor.state.selection.from, documentHash: hash },
              documentHash: hash,
            }));
          }
        }
      }
    } finally {
      setMessagesLoading(false);
    }
  }, [documentId, editor]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      Promise.all([aiClient.getProviders(), aiClient.getCredentialStatus(), loadConversations()])
        .then(([nextMetadata, nextCredential]) => {
          if (!mounted) return;
          setMetadata(nextMetadata);
          setCredential(nextCredential);
        })
        .catch((error) => mounted && setErrorMessageKey(errorKey(error)));
    }, 0);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [loadConversations, open, conversationVersion]);

  useEffect(() => {
    if (!open || !activeConversationId) {
      const timer = window.setTimeout(() => {
        setMessages([]);
        setMessageCursor(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => void loadMessages(activeConversationId), 0);
    return () => window.clearTimeout(timer);
  }, [activeConversationId, loadMessages, open]);

  useEffect(() => {
    // A pending draft is deliberately visual-only. Closing, navigating away,
    // or a document remount clears its local safety snapshot.
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (compositionEndTimerRef.current !== null) {
        window.clearTimeout(compositionEndTimerRef.current);
        compositionEndTimerRef.current = null;
      }
      setOperations(new Map());
    };
  }, [documentId]);

  async function addFiles(files: File[]) {
    const limits = metadata?.attachmentLimits;
    if (!limits || attachmentBusy) return;
    if (attachments.length + files.length > limits.maxFiles) {
      setErrorMessageKey("ai.smart.tooManyFiles");
      return;
    }
    const accepted = files.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      return ACCEPTED_EXTENSIONS.has(extension) && file.size <= limits.maxFileSizeBytes;
    });
    if (accepted.length !== files.length) {
      setErrorMessageKey("ai.smart.unsupportedFile");
      return;
    }
    const pending = accepted.map<AttachmentItem>((file) => ({ file, status: "extracting" }));
    setAttachments((current) => [...current, ...pending]);
    setState("extracting");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const [contexts, preparedAttachments] = await Promise.all([
        aiClient.extractAttachments(accepted, controller.signal),
        aiClient.prepareAttachments(accepted),
      ]);
      setAttachments((current) => current.map((item) => {
        const index = accepted.indexOf(item.file);
        if (index < 0) return item;
        const context = contexts[index];
        return context
          ? {
              ...item,
              context,
              prepared: preparedAttachments[index],
              status: context.warnings.length ? "warning" : "ready",
            }
          : { ...item, status: "error", errorKey: "ai.errors.attachment_parse_failed" };
      }));
      setState("ready");
    } catch (error) {
      setAttachments((current) => current.map((item) =>
        accepted.includes(item.file) && item.status === "extracting"
          ? { ...item, status: "error", errorKey: "ai.errors.attachment_parse_failed" }
          : item,
      ));
      setErrorMessageKey(errorKey(error));
      setState("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function prepareTurn(requestId: string): { request: AIConversationTurnRequest; operation: DraftOperation } {
    if (!editor || !documentId) throw new Error("editor_unavailable");
    const currentSelection = selectedContent(editor);
    let registry: ProtectedSelectionRegistry | null = null;
    let selectedFragment: AnvilNoteDocumentFragmentV1 | undefined;
    let selectionSnapshot: SelectionSnapshot | null = null;
    if (currentSelection) {
      registry = ProtectedSelectionRegistry.create();
      selectedFragment = tiptapSelectionToAnvilNote(currentSelection.content, registry);
      selectionSnapshot = createSelectionSnapshot({
        requestId,
        documentId,
        from: currentSelection.from,
        to: currentSelection.to,
        document: editor.getJSON(),
        selectedContent: currentSelection.content,
      });
    }
    const documentHash = stableDocumentHash(editor.getJSON());
    return {
      request: {
        requestId,
        ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        provider: { id: "openai", model: settings.aiModelId },
        instruction: instruction.trim(),
        context: {
          locale,
          writingStyle: settings.aiWritingStyle,
          ...(selectedFragment ? { selectedContent: selectedFragment } : {}),
          ...(readyAttachments.length ? { attachments: readyAttachments } : {}),
        },
        options: { humanizerEnabled: settings.aiHumanizerEnabled },
        ...(attachments.some((attachment) => attachment.prepared?.persisted)
          ? {
              attachmentIds: attachments.flatMap((attachment) =>
                attachment.prepared?.persisted ? [attachment.prepared.id] : [],
              ),
            }
          : {}),
      },
      operation: {
        registry,
        selectionSnapshot,
        cursor: currentSelection ? null : { position: editor.state.selection.from, documentHash },
        documentHash,
      },
    };
  }

  async function submit() {
    if (!instruction.trim()) {
      setErrorMessageKey("ai.smart.emptyInstruction");
      return;
    }
    if (!credential?.configured || attachmentBusy || attachmentError || state === "submitting") return;
    const requestId = crypto.randomUUID();
    try {
      const { request, operation } = prepareTurn(requestId);
      const optimisticConversationId = activeConversationId ?? `pending:${requestId}`;
      const optimisticUserMessage: AIConversationMessage = {
        id: requestId,
        conversationId: optimisticConversationId,
        sequence: (messages.at(-1)?.sequence ?? 0) + 1,
        role: "user",
        intent: request.context.selectedContent
          ? "rewrite-selection"
          : request.context.attachments?.length
            ? "compose-from-attachments"
            : "compose",
        content: request.instruction,
        ...(attachments.length
          ? {
              attachments: attachments.map<AIConversationAttachment>((item) =>
                item.prepared ?? {
                  id: crypto.randomUUID(),
                  originalName: item.file.name,
                  mimeType: item.file.type || "application/octet-stream",
                  sizeBytes: item.file.size,
                },
              ),
            }
          : {}),
        createdAt: new Date().toISOString(),
      };
      setState("submitting");
      setErrorMessageKey(null);
      setMessages((current) => [...current, optimisticUserMessage]);
      setInstruction("");
      setComposerLines(1);
      setAttachments([]);
      if (composerRef.current) {
        composerRef.current.style.height = `${COMPOSER_LINE_HEIGHT + COMPOSER_VERTICAL_PADDING}px`;
        composerRef.current.style.overflowY = "hidden";
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const completed = await aiClient.executeConversationTurn(documentId!, request, controller.signal);
      if (currentDocumentIdRef.current !== documentId) return;
      const assistant = completed.messages[1];
      setOperations((current) => new Map(current).set(assistant.id, operation));
      setConversations((current) => [completed.conversation, ...current.filter((item) => item.id !== completed.conversation.id)]);
      setActiveConversation(documentId!, completed.conversation.id);
      setMessages((current) => {
        const withoutOptimistic = current.filter((message) => message.id !== requestId);
        return activeConversationId === completed.conversation.id
          ? [...withoutOptimistic, ...completed.messages]
          : completed.messages;
      });
      setMessageCursor(null);
      setState("ready");
      notifyConversationChanged();
    } catch (error) {
      if (currentDocumentIdRef.current !== documentId) return;
      const messageKey = errorKey(error);
      if (messageKey === "ai.errors.request_cancelled") {
        setErrorMessageKey(null);
        setState("cancelled");
      } else {
        setErrorMessageKey(messageKey);
        setState("error");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("cancelled");
  }

  async function insertDraft(message: AIConversationMessage) {
    if (!editor || !documentId || !message.draft) return;
    if (applyingDraftsRef.current.has(message.id)) return;
    const operation = operations.get(message.id);
    if (!operation || operation.documentHash !== stableDocumentHash(editor.getJSON())) {
      setErrorMessageKey("ai.errors.selection_conflict");
      return;
    }
    applyingDraftsRef.current.add(message.id);
    try {
      // Persist and checkpoint the exact pre-insert editor state before any
      // compose insertion or accepted selection rewrite mutates it. Success
      // is intentionally silent; a failed checkpoint prevents the mutation.
      await snapshotBeforeAIInsert(documentId, editor.getJSON());
      if (message.draft.kind === "rewrite-selection" && operation.selectionSnapshot && operation.registry) {
        const snapshot = operation.selectionSnapshot;
        if (snapshot.to > editor.state.doc.content.size || hasSelectionConflict(snapshot, {
          document: editor.getJSON(),
          selectedContent: editor.state.doc.slice(snapshot.from, snapshot.to).content.toJSON() as JSONContent[],
        })) throw new Error("selection_conflict");
        const content = anvilNoteFragmentToTiptap(message.draft.replacement, operation.registry);
        if (!applyAIContent(editor, { from: snapshot.from, to: snapshot.to }, content)) throw new Error("conversion_failed");
      } else {
        const content = draftContent(message.draft);
        const cursor = operation.cursor;
        if (!cursor || cursor.documentHash !== stableDocumentHash(editor.getJSON())) throw new Error("selection_conflict");
        if (!applyAIContent(editor, { from: cursor.position, to: cursor.position }, content)) throw new Error("conversion_failed");
      }
      setOperations((current) => {
        const next = new Map(current);
        next.delete(message.id);
        return next;
      });
      editor.commands.focus();
    } catch (error) {
      setErrorMessageKey(errorKey(error));
    } finally {
      applyingDraftsRef.current.delete(message.id);
    }
  }

  async function replaceDraft(message: AIConversationMessage) {
    if (!editor || !documentId || !message.draft) return;
    const operation = operations.get(message.id);
    if (!operation || operation.documentHash !== stableDocumentHash(editor.getJSON())) {
      setErrorMessageKey("ai.errors.selection_conflict");
      return;
    }
    try {
      // Persist first, then remount Tiptap from the accepted document-store
      // value. This keeps a failed full-document PATCH from clearing the live
      // editor while still treating the successful replacement as one
      // explicit, durable action.
      const saved = await replaceWholeDocumentFromAI(
        documentId,
        { type: "doc", content: draftContent(message.draft) },
        draftTitle(message.draft),
      );
      if (!saved) throw new Error("conversion_failed");
      setOperations((current) => {
        const next = new Map(current);
        next.delete(message.id);
        return next;
      });
    } catch (error) {
      setErrorMessageKey(errorKey(error));
    }
  }

  async function renameConversation() {
    if (!documentId || !activeConversation || renamePendingRef.current) return;
    const nextTitle = renameTitle.trim();
    if (!nextTitle || nextTitle === activeConversation.title) {
      setRenameTitle(activeConversation.title);
      setRenamingConversation(false);
      return;
    }
    renamePendingRef.current = true;
    try {
      const updated = await aiClient.renameConversation(documentId, activeConversation.id, nextTitle);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setRenamingConversation(false);
    } catch (error) {
      setErrorMessageKey(errorKey(error));
    } finally {
      renamePendingRef.current = false;
    }
  }

  async function deleteConversation() {
    if (!documentId || !activeConversationId) return;
    try {
      await aiClient.deleteConversation(documentId, activeConversationId);
      setConversations((current) => current.filter((item) => item.id !== activeConversationId));
      setActiveConversation(documentId, null);
      setMessages([]);
      setMessageCursor(null);
      setDeleteOpen(false);
      notifyConversationChanged();
    } catch (error) {
      setErrorMessageKey(errorKey(error));
    }
  }

  const modelName = metadata?.providers
    .flatMap((provider) => provider.models)
    .find((model) => model.id === settings.aiModelId)?.displayName ?? settings.aiModelId;
  const resizeComposer = useCallback((element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    const naturalHeight = Math.max(
      COMPOSER_LINE_HEIGHT + COMPOSER_VERTICAL_PADDING,
      element.scrollHeight,
    );
    const nextHeight = Math.min(naturalHeight, MAX_COMPOSER_HEIGHT);
    const nextLines = Math.min(
      MAX_COMPOSER_LINES,
      Math.max(1, Math.ceil((naturalHeight - COMPOSER_VERTICAL_PADDING) / COMPOSER_LINE_HEIGHT)),
    );
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = naturalHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
    setComposerLines(nextLines);
  }, []);
  const attachmentButton = (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      className="bg-transparent hover:bg-transparent active:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent"
      aria-label={t("smart.addFiles")}
      disabled={state === "submitting" || attachmentBusy}
      onClick={() => fileInputRef.current?.click()}
    >
      <Plus className="size-5" />
    </Button>
  );
  const composerControls = (
    <>
      <Popover modal={false} open={writingStyleOpen} onOpenChange={setWritingStyleOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-9 min-w-24 justify-between rounded-full bg-muted/60 px-3 text-xs hover:bg-muted"
            aria-label={t("writingStyle.label")}
          >
            {t(`writingStyle.${settings.aiWritingStyle}` as never)}
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={14}
          className="w-44 gap-0 rounded-3xl p-2 shadow-xl"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-xs text-muted-foreground">{t("writingStyle.label")}</p>
          <div role="listbox" aria-label={t("writingStyle.label")}>
            {(["auto", "neutral", "natural", "preserve-source"] as WritingStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                role="option"
                aria-selected={style === settings.aiWritingStyle}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-sm hover:bg-muted ${style === settings.aiWritingStyle ? "bg-muted/70" : ""}`}
                onClick={() => {
                  settings.setAIWritingStyle(style);
                  setWritingStyleOpen(false);
                }}
              >
                {t(`writingStyle.${style}` as never)}
                {style === settings.aiWritingStyle ? <Check className="size-4" /> : null}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {state === "submitting" || state === "extracting" ? (
        <Button
          type="button"
          size="icon-sm"
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label={t("smart.cancel")}
          onClick={cancel}
        >
          <span data-testid="smart-stop-icon" className="size-2.5 rounded-[2px] bg-primary-foreground" />
        </Button>
      ) : (
        <Button
          type="button"
          size="icon-sm"
          className="rounded-full"
          aria-label={t("smart.generate")}
          disabled={!credential?.configured || !instruction.trim() || attachmentBusy || attachmentError}
          onClick={() => void submit()}
        >
          <Send className="size-4" />
        </Button>
      )}
    </>
  );

  return (
    <SheetContent
      id="smart-mode-panel"
      side="right"
      className="w-full gap-0 p-0 data-[side=right]:sm:!max-w-[30rem]"
      style={conversationSelectOpen ? { pointerEvents: "auto" } : undefined}
      showCloseButton={state !== "submitting" && state !== "extracting"}
      overlayClassName="!bg-transparent supports-backdrop-filter:!backdrop-blur-none"
      onInteractOutside={(event) => {
        if (state === "submitting" || state === "extracting") {
          event.preventDefault();
        }
      }}
    >
      <SheetHeader className="border-b pr-12">
        <div className="flex items-center gap-2">
          <SheetTitle>{t("smart.title")}</SheetTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{modelName}</span>
        </div>
        <SheetDescription>{selectionState ? t("smart.selected", { count: selectionState.text.length }) : t("smart.currentDocument")}</SheetDescription>
      </SheetHeader>

      <div className="border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center">
            {renamingConversation && activeConversation ? (
              <Input
                autoFocus
                aria-label={t("smart.renameConversation")}
                value={renameTitle}
                maxLength={255}
                onChange={(event) => setRenameTitle(event.target.value)}
                onBlur={() => {
                  if (!renameComposingRef.current) void renameConversation();
                }}
                onCompositionStart={() => {
                  renameComposingRef.current = true;
                  renameCompositionJustEndedRef.current = false;
                  if (renameCompositionEndTimerRef.current !== null) {
                    window.clearTimeout(renameCompositionEndTimerRef.current);
                    renameCompositionEndTimerRef.current = null;
                  }
                }}
                onCompositionEnd={() => {
                  renameComposingRef.current = false;
                  renameCompositionJustEndedRef.current = true;
                  renameCompositionEndTimerRef.current = window.setTimeout(() => {
                    renameCompositionJustEndedRef.current = false;
                    renameCompositionEndTimerRef.current = null;
                  }, 0);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                    && !renameComposingRef.current
                    && !renameCompositionJustEndedRef.current
                    && !event.nativeEvent.isComposing
                    && event.nativeEvent.keyCode !== 229
                  ) {
                    event.preventDefault();
                    void renameConversation();
                  } else if (event.key === "Escape" && !renameComposingRef.current) {
                    event.preventDefault();
                    setRenameTitle(activeConversation.title);
                    setRenamingConversation(false);
                  }
                }}
                className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            ) : activeConversation ? (
              <button
                type="button"
                aria-label={t("smart.renameConversation")}
                title={activeConversation.title}
                className="min-w-0 flex-1 truncate border-0 bg-transparent px-0 text-left text-sm hover:text-foreground"
                onClick={() => {
                  setRenameTitle(activeConversation.title);
                  setRenamingConversation(true);
                }}
              >
                {activeConversation.title}
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate px-0 text-sm text-muted-foreground">
                {t("smart.newConversation")}
              </span>
            )}
          </div>
          <Select
            open={conversationSelectOpen}
            onOpenChange={setConversationSelectOpen}
            value={activeConversationId ?? "__new__"}
            onValueChange={(conversationId) => {
              const nextConversationId = conversationId === "__new__" ? null : conversationId;
              setRenamingConversation(false);
              if (documentId) setActiveConversation(documentId, nextConversationId);
              if (!nextConversationId) {
                setMessages([]);
                setMessageCursor(null);
              }
            }}
          >
            <SelectTrigger
              className="h-8 w-auto shrink-0 rounded-lg border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
              aria-label={t("smart.switchConversation")}
            >
              <MessagesSquare className="size-4" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="end"
              sideOffset={4}
              avoidCollisions={false}
              className="min-w-64"
            >
              <SelectItem value="__new__">{t("smart.newConversation")}</SelectItem>
              {conversations.map((conversation) => (
                <SelectItem key={conversation.id} value={conversation.id}>{conversation.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("smart.newConversation")} onClick={() => {
            setRenamingConversation(false);
            if (documentId) setActiveConversation(documentId, null);
            setMessages([]);
            setMessageCursor(null);
          }}><MessageSquarePlus className="size-4" /></Button>
          {conversationCursor ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("smart.showMore")}
              title={t("smart.showMore")}
              onClick={() => void loadConversations(conversationCursor)}
            >
              <MessageSquareMore className="size-4" />
            </Button>
          ) : null}
          {activeConversation ? <>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("smart.delete")} onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /></Button>
          </> : null}
        </div>
      </div>

      <div data-testid="smart-mode-message-area" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!credential?.configured ? <div className="rounded-2xl border border-dashed p-4">
          <p className="font-medium">{t("smart.notConfigured")}</p>
          <Button className="mt-3" onClick={() => router.push("/settings")}>{t("smart.openSettings")}</Button>
        </div> : null}
        {activeConversationId && messageCursor ? <div className="mb-3 text-center"><Button type="button" size="sm" variant="ghost" disabled={messagesLoading} onClick={() => void loadMessages(activeConversationId, messageCursor)}>{messagesLoading ? <Loader2 className="size-4 animate-spin" /> : null}{t("smart.loadEarlier")}</Button></div> : null}
        {messages.length === 0 && activeConversationId ? <p className="py-8 text-center text-sm text-muted-foreground">{t("smart.emptyConversation")}</p> : null}
        <div className="space-y-4">
          {messages.map((message) => <div key={message.id} className={message.role === "user" ? "ml-10" : "mr-4"}>
            {message.role === "user" ? <UserMessage message={message} /> : <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm">{message.content}</div>}
            {message.role === "assistant" ? <DraftCard message={message} operation={operations.get(message.id)} disabled={state === "submitting"} onInsert={(value) => void insertDraft(value)} onReplace={(value) => void replaceDraft(value)} /> : null}
          </div>)}
        </div>
        {state === "submitting" ? <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("smart.submitting")}</div> : null}
        {errorMessageKey ? <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{t(errorMessageKey.replace(/^ai\./, "") as never)}</p> : null}
      </div>

      <div className="border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {attachments.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((item) => (
              <span
                key={`${item.file.name}-${item.file.lastModified}`}
                className={`inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs ${item.status === "error" ? "text-destructive" : ""}`}
              >
                {item.status === "extracting" ? (
                  <Loader2 className="size-3 shrink-0 animate-spin" />
                ) : (
                  <FileText className="size-3 shrink-0" />
                )}
                <span className="max-w-32 truncate">{item.file.name}</span>
                {item.status === "extracting" ? (
                  <span className="text-muted-foreground">{t("smart.extracting")}</span>
                ) : null}
                {item.status === "error" ? (
                  <span>{t("smart.attachmentError")}</span>
                ) : null}
                <button
                  type="button"
                  aria-label={t("smart.removeFile", { name: item.file.name })}
                  onClick={() => setAttachments((current) => current.filter((entry) => entry.file !== item.file))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div
          data-testid="smart-conversation-composer"
          className={`border border-input bg-background px-3 py-1 shadow-sm transition-[border-radius] ${composerRadius(composerLines)}`}
        >
          <div
            data-testid="smart-conversation-composer-row"
            className="flex items-end gap-2"
          >
            <div
              data-testid="smart-composer-attachment-control"
              className="flex h-10 shrink-0 items-center"
            >
              {attachmentButton}
            </div>
            <Textarea
              ref={composerRef}
              value={instruction}
              maxLength={MAX_INSTRUCTION_CHARACTERS}
              rows={1}
              placeholder={t("smart.promptPlaceholder")}
              className="min-h-10 max-h-64 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0"
              onChange={(event) => {
                setInstruction(event.target.value);
                resizeComposer(event.currentTarget);
              }}
              onCompositionStart={() => {
                composingRef.current = true;
                compositionJustEndedRef.current = false;
                if (compositionEndTimerRef.current !== null) {
                  window.clearTimeout(compositionEndTimerRef.current);
                  compositionEndTimerRef.current = null;
                }
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
                compositionJustEndedRef.current = true;
                compositionEndTimerRef.current = window.setTimeout(() => {
                  compositionJustEndedRef.current = false;
                  compositionEndTimerRef.current = null;
                }, 0);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !composingRef.current &&
                  !compositionJustEndedRef.current &&
                  !event.nativeEvent.isComposing &&
                  event.nativeEvent.keyCode !== 229
                ) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            <div
              data-testid="smart-composer-action-controls"
              className="flex h-10 shrink-0 items-center gap-1"
            >
              {composerControls}
            </div>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".txt,.md,.markdown,.pdf,.docx" onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>{t("smart.deleteConversation")}</DialogTitle><DialogDescription>{t("smart.deleteConversationDescription")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("common.cancel")}</Button><Button variant="destructive" onClick={() => void deleteConversation()}>{t("smart.delete")}</Button></DialogFooter></DialogContent></Dialog>
    </SheetContent>
  );
}
