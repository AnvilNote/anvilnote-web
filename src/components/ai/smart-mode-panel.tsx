"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { FileText, Loader2, Paperclip, RotateCcw, Trash2 } from "lucide-react";
import type {
  AIWriterRequest,
  AIWriterResult,
  AttachmentContext,
  WritingStyle,
} from "@anvilnote/ai-writer/contracts";
import type { AnvilNoteDocumentFragmentV1 } from "@anvilnote/ai-writer/document";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AIDocumentPreview, aiDocumentPlainText } from "./ai-document-preview";
import { AIClientError, aiClient, type AIProviderMetadata, type AISecretStatus, type AIWriterCostEstimate } from "@/lib/ai/runtime-client";
import {
  anvilNoteDocumentToTiptap,
  anvilNoteFragmentToTiptap,
  tiptapDocumentToAnvilNote,
  tiptapSelectionToAnvilNote,
  UnsupportedAIContentError,
} from "@/lib/ai/document/converters";
import { applyAIContent, isEmptyEditorDocument } from "@/lib/ai/document/editor-operations";
import { ProtectedSelectionRegistry } from "@/lib/ai/document/protected-selection";
import {
  createSelectionSnapshot,
  hasSelectionConflict,
  stableDocumentHash,
  type SelectionSnapshot,
} from "@/lib/ai/document/selection-snapshot";
import { createWordDiff } from "@/lib/ai/document/word-diff";
import { buildSmartModeRequest, deriveWriterIntent } from "@/lib/ai/smart-mode-request";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { useSettingsStore } from "@/lib/stores/settings-store";

const MAX_INSTRUCTION_CHARACTERS = 50_000;
const ACCEPTED_EXTENSIONS = new Set(["txt", "md", "markdown", "pdf", "docx"]);

type SmartModeState =
  | "idle"
  | "extracting-attachments"
  | "estimating"
  | "ready"
  | "submitting"
  | "success"
  | "error"
  | "cancelled"
  | "conflict";

interface AttachmentItem {
  file: File;
  status: "extracting" | "ready" | "warning" | "error";
  context?: AttachmentContext;
  errorKey?: string;
}

interface SelectionInfo {
  from: number;
  to: number;
  content: JSONContent[];
  text: string;
  characterCount: number;
}

interface OperationContext {
  request: AIWriterRequest;
  registry: ProtectedSelectionRegistry | null;
  selectionSnapshot: SelectionSnapshot | null;
  originalText: string;
  cursor: { position: number; documentHash: string } | null;
}

function selectedContent(editor: NonNullable<ReturnType<typeof useEditorBridge.getState>["editor"]>): SelectionInfo | null {
  const { from, to } = editor.state.selection;
  if (from === to) return null;
  const content = editor.state.doc.slice(from, to).content.toJSON() as JSONContent[];
  return {
    from,
    to,
    content,
    text: editor.state.doc.textBetween(from, to, "\n"),
    characterCount: editor.state.doc.textBetween(from, to, "").length,
  };
}

function resultDocument(result: AIWriterResult) {
  return result.kind === "compose" ? result.document : result.replacement;
}

function usd(value: number): string {
  if (value > 0 && value < 0.01) return "< US$0.01";
  return `US$${value.toFixed(value < 0.1 ? 3 : 2)}`;
}

function errorKey(error: unknown): string {
  if (error instanceof UnsupportedAIContentError) return "ai.errors.unsupported_selection";
  if (error instanceof AIClientError) {
    const knownCodes = new Set([
      "invalid_api_key",
      "permission_denied",
      "insufficient_credit",
      "model_unavailable",
      "rate_limited",
      "request_too_large",
      "context_length_exceeded",
      "invalid_structured_output",
      "invalid_request_schema",
      "provider_timeout",
      "request_cancelled",
      "network_error",
      "attachment_parse_failed",
      "password_protected_pdf",
      "unsupported_attachment",
      "selection_conflict",
      "provider_refusal",
      "incomplete_response",
      "provider_error",
      "invalid_request",
      "secure_storage_unavailable",
      "browser_unavailable",
      "unknown_error",
    ]);
    return knownCodes.has(error.shape.code)
      ? `ai.errors.${error.shape.code}`
      : "ai.errors.unknown_error";
  }
  if (error instanceof DOMException && error.name === "AbortError") return "ai.errors.request_cancelled";
  if (error instanceof Error) {
    const localCodes: Record<string, string> = {
      invalid_structured_output: "ai.errors.invalid_structured_output",
      selection_conflict: "ai.errors.selection_conflict",
      conversion_failed: "ai.errors.conversion_failed",
      editor_unavailable: "ai.errors.editor_unavailable",
    };
    if (localCodes[error.message]) return localCodes[error.message];
  }
  if (error && typeof error === "object" && "code" in error) {
    return `ai.errors.${String((error as { code: unknown }).code)}`;
  }
  return "ai.errors.unknown_error";
}

export function SmartModePanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const t = useTranslations("ai");
  const locale = useLocale();
  const router = useRouter();
  const editor = useEditorBridge((state) => state.editor);
  const documentId = useEditorBridge((state) => state.documentId);
  const settings = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const operationRef = useRef<OperationContext | null>(null);

  const [state, setState] = useState<SmartModeState>("idle");
  const [instruction, setInstruction] = useState("");
  const [selectionState, setSelectionState] = useState<{
    editor: typeof editor;
    value: SelectionInfo | null;
  }>(() => ({ editor, value: editor ? selectedContent(editor) : null }));
  const selection = selectionState.editor === editor
    ? selectionState.value
    : editor ? selectedContent(editor) : null;
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [metadata, setMetadata] = useState<AIProviderMetadata | null>(null);
  const [credential, setCredential] = useState<AISecretStatus | null>(null);
  const [estimate, setEstimate] = useState<AIWriterCostEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [result, setResult] = useState<AIWriterResult | null>(null);
  const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState("");

  const updateSelection = useCallback(() => {
    setSelectionState({ editor, value: editor ? selectedContent(editor) : null });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("selectionUpdate", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
    };
  }, [editor, updateSelection]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([aiClient.getProviders(), aiClient.getCredentialStatus()])
      .then(([nextMetadata, nextCredential]) => {
        if (!active) return;
        setMetadata(nextMetadata);
        setCredential(nextCredential);
        setState((current) => (current === "idle" ? "ready" : current));
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessageKey(errorKey(error));
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [open]);

  const readyAttachments = useMemo(
    () => attachments.flatMap((item) => (item.context ? [item.context] : [])),
    [attachments],
  );
  const intent = deriveWriterIntent(Boolean(selection), readyAttachments.length);
  const hasAttachmentError = attachments.some((item) => item.status === "error");
  const attachmentBusy = attachments.some((item) => item.status === "extracting");

  const prepareOperation = useCallback((requestId: string): OperationContext => {
    if (!editor || !documentId) throw new Error("editor_unavailable");
    const currentSelection = selectedContent(editor);
    const document = editor.getJSON();
    let registry: ProtectedSelectionRegistry | null = null;
    let fragment: AnvilNoteDocumentFragmentV1 | undefined;
    let snapshot: SelectionSnapshot | null = null;

    if (currentSelection) {
      registry = ProtectedSelectionRegistry.create();
      fragment = tiptapSelectionToAnvilNote(currentSelection.content, registry);
      snapshot = createSelectionSnapshot({
        requestId,
        documentId,
        from: currentSelection.from,
        to: currentSelection.to,
        document,
        selectedContent: currentSelection.content,
      });
    }

    let currentDocument;
    try {
      currentDocument = tiptapDocumentToAnvilNote(document);
    } catch {
      // Unsupported existing blocks must never disappear from a rewrite. For
      // compose they are simply not sent as optional style context.
    }

    const request = buildSmartModeRequest({
      requestId,
      model: settings.aiModelId,
      instruction,
      locale,
      writingStyle: settings.aiWritingStyle,
      humanizerEnabled: settings.aiHumanizerEnabled,
      ...(currentDocument ? { currentDocument } : {}),
      ...(fragment ? { selectedContent: fragment } : {}),
      attachments: readyAttachments,
    });
    return {
      request,
      registry,
      selectionSnapshot: snapshot,
      originalText: currentSelection?.text ?? "",
      cursor: currentSelection
        ? null
        : {
            position: editor.state.selection.from,
            documentHash: stableDocumentHash(document),
          },
    };
  }, [documentId, editor, instruction, locale, readyAttachments, settings.aiHumanizerEnabled, settings.aiModelId, settings.aiWritingStyle]);

  useEffect(() => {
    if (!open || !editor || !instruction.trim() || hasAttachmentError || attachmentBusy || activeRequestRef.current) {
      setEstimate(null);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const operation = prepareOperation(crypto.randomUUID());
        setEstimating(true);
        void aiClient.estimate(operation.request)
          .then((value) => setEstimate(value))
          .catch(() => setEstimate(null))
          .finally(() => setEstimating(false));
      } catch {
        setEstimate(null);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [attachmentBusy, editor, hasAttachmentError, instruction, open, prepareOperation]);

  async function addFiles(files: File[]) {
    const limits = metadata?.attachmentLimits;
    if (!limits) return;
    if (attachments.length + files.length > limits.maxFiles) {
      setErrorMessageKey("ai.smart.tooManyFiles");
      return;
    }
    const accepted = files.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      return ACCEPTED_EXTENSIONS.has(extension) && file.size <= limits.maxFileSizeBytes;
    });
    if (accepted.length !== files.length) {
      setErrorMessageKey(files.some((file) => file.size > limits.maxFileSizeBytes) ? "ai.smart.fileTooLarge" : "ai.smart.unsupportedFile");
      return;
    }
    const total = [...attachments.map((item) => item.file), ...accepted]
      .reduce((sum, file) => sum + file.size, 0);
    if (total > limits.maxTotalSizeBytes) {
      setErrorMessageKey("ai.errors.request_too_large");
      return;
    }
    const pending = accepted.map<AttachmentItem>((file) => ({ file, status: "extracting" }));
    setAttachments((current) => [...current, ...pending]);
    setState("extracting-attachments");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const contexts = await aiClient.extractAttachments(accepted, controller.signal);
      setAttachments((current) => current.map((item) => {
        const index = accepted.indexOf(item.file);
        if (index < 0) return item;
        const context = contexts[index];
        return context
          ? { ...item, context, status: context.warnings.length ? "warning" : "ready" }
          : { ...item, status: "error", errorKey: "ai.errors.attachment_parse_failed" };
      }));
      setState("ready");
    } catch (error) {
      const key = errorKey(error);
      setAttachments((current) => current.map((item) => accepted.includes(item.file) ? { ...item, status: "error", errorKey: key } : item));
      setErrorMessageKey(key);
      setState(key.endsWith("request_cancelled") ? "cancelled" : "error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function removeAttachment(file: File) {
    setAttachments((current) => current.filter((item) => item.file !== file));
  }

  async function submit() {
    if (!instruction.trim()) {
      setErrorMessageKey("ai.smart.emptyInstruction");
      return;
    }
    if (!credential?.configured) return;
    if (hasAttachmentError || state === "submitting") return;
    const requestId = crypto.randomUUID();
    try {
      updateSelection();
      const operation = prepareOperation(requestId);
      operationRef.current = operation;
      activeRequestRef.current = requestId;
      setOriginalText(operation.originalText);
      setErrorMessageKey(null);
      setResult(null);
      setState("submitting");
      const controller = new AbortController();
      abortRef.current = controller;
      const nextResult = await aiClient.execute(operation.request, controller.signal);
      if (activeRequestRef.current !== requestId || controller.signal.aborted) return;

      if (nextResult.kind === "rewrite-selection") {
        if (!operation.registry || !operation.selectionSnapshot) throw new Error("invalid_structured_output");
        anvilNoteFragmentToTiptap(nextResult.replacement, operation.registry);
        const { from, to } = operation.selectionSnapshot;
        const conflict = to > editor!.state.doc.content.size || hasSelectionConflict(
          operation.selectionSnapshot,
          {
            document: editor!.getJSON(),
            selectedContent: to <= editor!.state.doc.content.size
              ? editor!.state.doc.slice(from, to).content.toJSON() as JSONContent[]
              : [],
          },
        );
        setResult(nextResult);
        setState(conflict ? "conflict" : "success");
      } else {
        anvilNoteDocumentToTiptap(nextResult.document);
        const conflict = operation.cursor?.documentHash !== stableDocumentHash(editor!.getJSON());
        setResult(nextResult);
        setState(conflict ? "conflict" : "success");
      }
    } catch (error) {
      if (activeRequestRef.current !== requestId) return;
      const key = errorKey(error);
      setErrorMessageKey(key);
      setState(key.endsWith("request_cancelled") ? "cancelled" : "error");
    } finally {
      if (activeRequestRef.current === requestId) activeRequestRef.current = null;
      abortRef.current = null;
    }
  }

  function cancel() {
    const requestId = activeRequestRef.current;
    activeRequestRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (requestId) void aiClient.cancel(requestId);
    setState("cancelled");
  }

  function applyResult(mode: "insert" | "replace") {
    if (!editor || !result || state === "conflict") return;
    const operation = operationRef.current;
    if (!operation) return;
    try {
      if (result.kind === "rewrite-selection") {
        const snapshot = operation.selectionSnapshot;
        if (!snapshot || !operation.registry) throw new Error("selection_conflict");
        if (snapshot.to > editor.state.doc.content.size || hasSelectionConflict(snapshot, {
          document: editor.getJSON(),
          selectedContent: editor.state.doc.slice(snapshot.from, snapshot.to).content.toJSON() as JSONContent[],
        })) {
          setState("conflict");
          return;
        }
        const content = anvilNoteFragmentToTiptap(result.replacement, operation.registry);
        if (!applyAIContent(editor, { from: snapshot.from, to: snapshot.to }, content)) throw new Error("conversion_failed");
      } else {
        const content = anvilNoteDocumentToTiptap(result.document).content ?? [];
        if (mode === "replace") {
          if (!isEmptyEditorDocument(editor)) throw new Error("selection_conflict");
          if (!applyAIContent(editor, { from: 0, to: editor.state.doc.content.size }, content)) throw new Error("conversion_failed");
        } else {
          const cursor = operation.cursor;
          if (!cursor || cursor.documentHash !== stableDocumentHash(editor.getJSON())) {
            setState("conflict");
            return;
          }
          if (!applyAIContent(editor, { from: cursor.position, to: cursor.position }, content)) throw new Error("conversion_failed");
        }
      }
      setResult(null);
      operationRef.current = null;
      setState("ready");
      editor.commands.focus();
    } catch (error) {
      setErrorMessageKey(errorKey(error));
      setState("error");
    }
  }

  function reject() {
    setResult(null);
    operationRef.current = null;
    setState("ready");
  }

  function closeRequested(nextOpen: boolean) {
    if (!nextOpen && (state === "submitting" || state === "extracting-attachments")) {
      if (!window.confirm(t("smart.closeWhileRunning"))) return;
      cancel();
    }
    onOpenChange(nextOpen);
  }

  const estimateText = estimate?.cost
    ? estimate.cost.minimum === estimate.cost.maximum
      ? usd(estimate.cost.minimum)
      : `${usd(estimate.cost.minimum)}–${usd(estimate.cost.maximum)}`
    : null;
  const rewrite = intent === "rewrite-selection";
  const resultText = result ? aiDocumentPlainText(resultDocument(result)) : "";

  return (
    <SheetContent
      id="smart-mode-panel"
      className="w-full pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-xl"
      showCloseButton={state !== "submitting" && state !== "extracting-attachments"}
      onEscapeKeyDown={(event) => {
        if (state === "submitting" || state === "extracting-attachments") {
          if (!window.confirm(t("smart.closeWhileRunning"))) event.preventDefault();
          else cancel();
        }
      }}
      onPointerDownOutside={(event) => (state === "submitting" || state === "extracting-attachments") && event.preventDefault()}
      onInteractOutside={(event) => (state === "submitting" || state === "extracting-attachments") && event.preventDefault()}
    >
      <SheetHeader className="border-b pr-12">
        <SheetTitle>{t("smart.title")}</SheetTitle>
        <SheetDescription>{rewrite && selection ? t("smart.selected", { count: selection.characterCount }) : t("smart.currentDocument")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {selection ? <Badge variant="secondary">{t("smart.selected", { count: selection.characterCount })}</Badge> : null}
        {!credential?.configured ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">{t("smart.notConfigured")}</p>
            <Button onClick={() => { closeRequested(false); router.push("/settings"); }}>
              {t("smart.openSettings")}
            </Button>
          </div>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("smart.attachments")}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={state === "submitting" || state === "extracting-attachments"}>
              <Paperclip className="size-4" />{t("smart.addFiles")}
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
          </div>
          {attachments.map((item) => (
            <div key={`${item.file.name}-${item.file.lastModified}`} className="flex items-start gap-3 rounded-lg border px-3 py-2">
              <FileText className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.status === "extracting" ? t("smart.extracting") : item.status === "error" ? t("smart.attachmentError") : item.status === "warning" ? t("smart.attachmentWarning") : t("smart.attachmentReady", { count: item.context?.characterCount ?? 0 })}
                </p>
                {item.context?.warnings.map((warning) => <p key={warning} className="text-xs text-destructive">{t(`attachments.${warning}` as never)}</p>)}
              </div>
              {item.status === "extracting" ? <Loader2 className="size-4 animate-spin" /> : (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("smart.removeFile", { name: item.file.name })} onClick={() => removeAttachment(item.file)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <label htmlFor="smart-mode-instruction" className="text-sm font-medium">{t("smart.promptLabel")}</label>
          <Textarea id="smart-mode-instruction" rows={5} maxLength={MAX_INSTRUCTION_CHARACTERS} value={instruction} placeholder={t("smart.promptPlaceholder")} onChange={(event) => setInstruction(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); } }} />
          <p className="text-right text-xs text-muted-foreground">{t("smart.characterCount", { count: instruction.length, max: MAX_INSTRUCTION_CHARACTERS })}</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("settings.defaultStyle")}</label>
            <Select value={settings.aiWritingStyle} onValueChange={(value) => settings.setAIWritingStyle(value as WritingStyle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["auto", "neutral", "natural", "preserve-source"] as WritingStyle[]).map((style) => <SelectItem key={style} value={style}>{t(`writingStyle.${style}` as never)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-xs font-medium">{t("settings.humanizer")}</span>
            <Switch checked={settings.aiHumanizerEnabled} onCheckedChange={settings.setAIHumanizerEnabled} aria-label={t("settings.humanizer")} />
          </div>
        </section>

        <section className="rounded-lg border px-3 py-2 text-xs">
          <div className="flex justify-between"><span>{t("smart.model")}</span><span>{metadata?.providers.flatMap((provider) => provider.models).find((model) => model.id === settings.aiModelId)?.displayName ?? settings.aiModelId}</span></div>
          <div className="mt-1 flex justify-between"><span>{t("smart.estimatedCost")}</span><span>{estimating ? t("smart.estimating") : estimateText ?? t("smart.estimateUnavailable")}</span></div>
          <p className="mt-2 text-muted-foreground">{t("smart.estimateDisclaimer")}</p>
        </section>

        {errorMessageKey ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{t(errorMessageKey.replace(/^ai\./, "") as never)}</div> : null}
        {state === "cancelled" ? <p role="status" className="text-sm text-muted-foreground">{t("smart.cancelled")}</p> : null}
        {state === "conflict" ? (
          <div role="alert" className="space-y-3 rounded-lg border p-3">
            <p className="font-medium">{t("smart.conflict")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void navigator.clipboard.writeText(resultText)}>{t("smart.copyResult")}</Button>
              <Button onClick={() => void submit()}>{t("smart.runAgain")}</Button>
            </div>
          </div>
        ) : null}

        {result ? (
          <section className="space-y-4" aria-live="polite">
            <Separator />
            {result.kind === "compose" && result.suggestedTitle ? <div><p className="text-xs font-medium">{t("smart.suggestedTitle")}</p><p>{result.suggestedTitle}</p></div> : null}
            {result.kind === "rewrite-selection" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="mb-1 text-xs font-medium">{t("smart.original")}</p><div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{originalText}</div></div>
                  <div><p className="mb-1 text-xs font-medium">{t("smart.suggested")}</p><AIDocumentPreview document={result.replacement} /></div>
                </div>
                <div className="rounded-lg border p-3 text-sm" aria-label={t("smart.changeSummary")}>
                  {createWordDiff(originalText, resultText).map((part, index) => part.kind === "equal" ? <span key={index}>{part.text}</span> : part.kind === "add" ? <ins key={index} className="rounded bg-muted px-0.5">{part.text}</ins> : <del key={index} className="text-muted-foreground">{part.text}</del>)}
                </div>
                <p className="text-sm text-muted-foreground">{result.changeSummary}</p>
              </>
            ) : <AIDocumentPreview document={result.document} />}
            {result.warnings.length ? <div><p className="text-xs font-medium">{t("smart.warnings")}</p><ul className="list-disc pl-5 text-xs text-muted-foreground">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
            <div className="rounded-lg border p-3 text-xs">
              <p className="mb-2 font-medium">{t("smart.usage")}</p>
              {result.usage.inputTokens === null ? <p>{t("smart.usageUnavailable")}</p> : (
                <dl className="grid grid-cols-[1fr_auto] gap-1">
                  <dt>{t("smart.inputTokens")}</dt><dd>{result.usage.inputTokens}</dd>
                  {result.usage.cachedInputTokens !== undefined ? <><dt>{t("smart.cachedTokens")}</dt><dd>{result.usage.cachedInputTokens}</dd></> : null}
                  <dt>{t("smart.outputTokens")}</dt><dd>{result.usage.outputTokens ?? "—"}</dd>
                  {result.usage.reasoningTokens !== undefined ? <><dt>{t("smart.reasoningTokens")}</dt><dd>{result.usage.reasoningTokens}</dd></> : null}
                  <dt>{t("smart.totalTokens")}</dt><dd>{result.usage.totalTokens ?? "—"}</dd>
                  <dt>{t("smart.actualCost")}</dt><dd>{result.usage.estimatedActualCostUsd === null ? "—" : usd(result.usage.estimatedActualCostUsd)}</dd>
                </dl>
              )}
            </div>
          </section>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t p-4">
        {state === "submitting" || state === "extracting-attachments" ? (
          <Button variant="outline" onClick={cancel}>{t("smart.cancel")}</Button>
        ) : null}
        {result && state !== "conflict" ? (
          <>
            <Button variant="outline" onClick={reject}>{t("smart.reject")}</Button>
            <Button variant="outline" onClick={() => void submit()}><RotateCcw className="size-4" />{t("smart.regenerate")}</Button>
            {result.kind === "rewrite-selection" ? <Button onClick={() => applyResult("replace")}>{t("smart.accept")}</Button> : editor && isEmptyEditorDocument(editor) ? <Button onClick={() => applyResult("replace")}>{t("smart.replaceEmpty")}</Button> : <Button onClick={() => applyResult("insert")}>{t("smart.insertAtCursor")}</Button>}
          </>
        ) : state !== "conflict" ? (
          <Button disabled={!credential?.configured || !instruction.trim() || hasAttachmentError || state === "submitting" || state === "extracting-attachments"} onClick={() => void submit()}>{state === "submitting" ? <Loader2 className="size-4 animate-spin" /> : null}{rewrite ? t("smart.rewrite") : t("smart.generate")}</Button>
        ) : null}
      </div>
    </SheetContent>
  );
}
