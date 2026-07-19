import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/ui/sheet";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { useSmartModeUIStore } from "@/lib/stores/smart-mode-ui-store";

const client = vi.hoisted(() => ({
  getProviders: vi.fn(),
  getCredentialStatus: vi.fn(),
  estimate: vi.fn(),
  execute: vi.fn(),
  cancel: vi.fn(),
  extractAttachments: vi.fn(),
  prepareAttachments: vi.fn(),
  listConversations: vi.fn(),
  listConversationMessages: vi.fn(),
  executeConversationTurn: vi.fn(),
  renameConversation: vi.fn(),
  deleteConversation: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/ai/runtime-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/runtime-client")>();
  return { ...original, aiClient: client };
});

import { SmartModePanel } from "./smart-mode-panel";

const metadata = {
  providers: [{
    id: "openai",
    displayName: "OpenAI",
    enabled: true,
    setupGuide: { titleKey: "", descriptionKey: "", documentationUrl: "", steps: [], notices: [] },
    models: [{ id: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", enabled: true }],
  }],
  attachmentLimits: {
    maxFiles: 5,
    maxFileSizeBytes: 10_485_760,
    maxTotalSizeBytes: 26_214_400,
    maxCharactersPerFile: 100_000,
    maxTotalExtractedCharacters: 200_000,
  },
};

function createEditor() {
  return new Editor({
    extensions: [StarterKit],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Selected text" }] }] },
  });
}

describe("SmartModePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSmartModeUIStore.setState({
      open: false,
      activeConversationByDocument: {},
      inlineFallbackInstructionByDocument: {},
      conversationVersion: 0,
    });
    client.getProviders.mockResolvedValue(metadata);
    client.listConversations.mockResolvedValue({ data: [], nextCursor: null });
  });

  it("keeps the launcher workflow visible but blocks generation when no key is configured", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: false, storage: "session-only" });
    render(<Sheet open><SmartModePanel open /></Sheet>);

    expect(await screen.findByText("smart.notConfigured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "smart.generate" })).toBeDisabled();
    editor.destroy();
  });

  it("captures a text selection as context without exposing a mode selector", async () => {
    const editor = createEditor();
    editor.commands.setTextSelection({ from: 1, to: 9 });
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    render(<Sheet open><SmartModePanel open /></Sheet>);

    expect(await screen.findByRole("button", { name: "smart.generate" })).toBeInTheDocument();
    expect(screen.queryByText(/Compose|Rewrite mode/)).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "settings.humanizer" })).not.toBeInTheDocument();
    editor.destroy();
  });

  it("renders the shared shadcn Select for document conversation switching", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.listConversations.mockResolvedValue({
      data: [
        { id: "conversation-1", documentId: "doc-1", title: "First", lastMessageAt: "2026-07-19T00:00:00.000Z", createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" },
        { id: "conversation-2", documentId: "doc-1", title: "Second", lastMessageAt: "2026-07-18T00:00:00.000Z", createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:00.000Z" },
      ],
      nextCursor: null,
    });
    client.listConversationMessages.mockResolvedValue({ data: [], nextCursor: null });

    render(<Sheet open><SmartModePanel open /></Sheet>);

    const selector = await screen.findByRole("combobox");
    expect(selector).toHaveAttribute("data-slot", "select-trigger");
    expect(selector).toHaveTextContent("First");
    editor.destroy();
  });

  it("starts the right-panel composer at exactly one line even when text is selected", async () => {
    const editor = createEditor();
    editor.commands.setTextSelection({ from: 1, to: 9 });
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });

    render(<Sheet open><SmartModePanel open /></Sheet>);

    const composer = await screen.findByRole("textbox");
    expect(composer).toHaveAttribute("rows", "1");
    expect(composer.className).toContain("overflow-y-auto");
    expect(screen.getByTestId("smart-conversation-composer")).toHaveClass("rounded-full");
    editor.destroy();
  });

  it("grows wrapped composer text to ten lines, changes its radius, and keeps controls on the last row", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    render(<Sheet open><SmartModePanel open /></Sheet>);

    const composer = await screen.findByRole("textbox");
    Object.defineProperty(composer, "scrollHeight", { configurable: true, get: () => 320 });
    fireEvent.change(composer, { target: { value: "A long wrapped instruction" } });

    expect(composer).toHaveStyle({ height: "256px", overflowY: "auto" });
    expect(screen.getByTestId("smart-conversation-composer")).toHaveClass("rounded-lg");
    expect(screen.getByTestId("smart-conversation-composer-row")).toHaveClass("items-end");
    expect(screen.getByTestId("smart-composer-attachment-control")).toHaveClass("h-10", "items-center");
    expect(screen.getByTestId("smart-composer-action-controls")).toHaveClass("h-10", "items-center");
    editor.destroy();
  });

  it("renders user text at a twenty-character measure with copy and compact attachment overflow", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.listConversations.mockResolvedValue({
      data: [{ id: "conversation-1", documentId: "doc-1", title: "Files", lastMessageAt: "2026-07-19T00:00:00.000Z", createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" }],
      nextCursor: null,
    });
    client.listConversationMessages.mockResolvedValue({
      data: [{
        id: "message-1",
        conversationId: "conversation-1",
        sequence: 1,
        role: "user",
        intent: "compose",
        content: "這是一段超過二十個全形中文字的測試指令內容",
        attachments: [
          { id: "attachment-1", originalName: "one.pdf", mimeType: "application/pdf", sizeBytes: 10 },
          { id: "attachment-2", originalName: "two.pdf", mimeType: "application/pdf", sizeBytes: 20 },
          { id: "attachment-3", originalName: "three.pdf", mimeType: "application/pdf", sizeBytes: 30 },
          { id: "attachment-4", originalName: "four.pdf", mimeType: "application/pdf", sizeBytes: 40 },
        ],
        createdAt: "2026-07-19T00:00:00.000Z",
      }],
      nextCursor: null,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<Sheet open><SmartModePanel open /></Sheet>);

    const messageText = await screen.findByText("這是一段超過二十個全形中文字的測試指令內容");
    expect(messageText).toHaveClass("max-w-[20em]");
    expect(messageText.parentElement).toHaveClass("relative", "pr-10");
    expect(screen.getByRole("button", { name: "smart.copyMessage" })).toHaveClass(
      "absolute",
      "right-2",
      "top-1.5",
    );
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(screen.getByText("two.pdf")).toBeInTheDocument();
    expect(screen.queryByText("three.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "smart.copyMessage" }));
    expect(writeText).toHaveBeenCalledWith("這是一段超過二十個全形中文字的測試指令內容");
    editor.destroy();
  });

  it("shows sent attachment chips immediately and forwards only desktop-prepared ids", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.extractAttachments.mockResolvedValue([{
      id: "context-1",
      filename: "notes.txt",
      mediaType: "text/plain",
      text: "notes",
      characterCount: 5,
      warnings: [],
    }]);
    client.prepareAttachments.mockResolvedValue([{
      id: "attachment-1",
      originalName: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      persisted: true,
    }]);
    client.executeConversationTurn.mockImplementation(() => new Promise(() => {}));
    render(<Sheet open><SmartModePanel open /></Sheet>);
    await screen.findByRole("textbox");
    await waitFor(() => expect(screen.getByRole("button", { name: "smart.addFiles" })).not.toBeDisabled());
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(["notes"], "notes.txt", { type: "text/plain" })] } });
    await waitFor(() => expect(client.prepareAttachments).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Summarize this" } });
    fireEvent.click(screen.getByRole("button", { name: "smart.generate" }));

    await waitFor(() => expect(client.executeConversationTurn).toHaveBeenCalledTimes(1));
    expect(client.executeConversationTurn.mock.calls[0][1].attachmentIds).toEqual(["attachment-1"]);
    expect(within(screen.getByTestId("smart-mode-message-area")).getByText("notes.txt")).toBeInTheDocument();
    editor.destroy();
  });

  it("shows attachment processing and enables send as soon as extraction completes", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    let resolveExtraction!: (contexts: Array<Record<string, unknown>>) => void;
    client.extractAttachments.mockImplementation(() => new Promise((resolve) => {
      resolveExtraction = resolve;
    }));
    client.prepareAttachments.mockResolvedValue([{
      id: "attachment-1",
      originalName: "notes.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5,
      persisted: true,
    }]);
    render(<Sheet open><SmartModePanel open /></Sheet>);
    const composer = await screen.findByRole("textbox");
    await waitFor(() => expect(screen.getByRole("button", { name: "smart.addFiles" })).not.toBeDisabled());
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, { target: { files: [new File(["notes"], "notes.pdf", { type: "application/pdf" })] } });
    fireEvent.change(composer, { target: { value: "Use this file" } });

    expect(await screen.findByText("smart.extracting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "smart.cancel" })).toBeInTheDocument();

    await act(async () => resolveExtraction([{
      id: "context-1",
      filename: "notes.pdf",
      mediaType: "application/pdf",
      text: "notes",
      characterCount: 5,
      warnings: [],
    }]));
    await waitFor(() => expect(screen.getByRole("button", { name: "smart.generate" })).not.toBeDisabled());
    expect(screen.queryByText("smart.extracting")).not.toBeInTheDocument();
    editor.destroy();
  });

  it("marks failed attachment extraction as removable instead of staying busy forever", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.extractAttachments.mockRejectedValue(new Error("attachment extraction failed"));
    client.prepareAttachments.mockResolvedValue([{
      id: "attachment-1",
      originalName: "notes.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5,
      persisted: true,
    }]);
    render(<Sheet open><SmartModePanel open /></Sheet>);
    const composer = await screen.findByRole("textbox");
    await waitFor(() => expect(screen.getByRole("button", { name: "smart.addFiles" })).not.toBeDisabled());
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, { target: { files: [new File(["notes"], "notes.pdf", { type: "application/pdf" })] } });
    fireEvent.change(composer, { target: { value: "Use this file" } });

    expect(await screen.findByText("smart.attachmentError")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "smart.generate" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: 'smart.removeFile:{"name":"notes.pdf"}' }));
    await waitFor(() => expect(screen.getByRole("button", { name: "smart.generate" })).not.toBeDisabled());
    editor.destroy();
  });

  it("does not submit Enter while an IME composition is selecting text", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.executeConversationTurn.mockImplementation(() => new Promise(() => {}));
    render(<Sheet open><SmartModePanel open /></Sheet>);

    const composer = await screen.findByRole("textbox");
    fireEvent.change(composer, { target: { value: "注音輸入" } });
    fireEvent.compositionStart(composer);
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    expect(client.executeConversationTurn).not.toHaveBeenCalled();
    fireEvent.compositionEnd(composer);
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    expect(client.executeConversationTurn).not.toHaveBeenCalled();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(client.executeConversationTurn).toHaveBeenCalledTimes(1));
    editor.destroy();
  });

  it("does not submit an IME process-key Enter event", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.executeConversationTurn.mockImplementation(() => new Promise(() => {}));
    render(<Sheet open><SmartModePanel open /></Sheet>);

    const composer = await screen.findByRole("textbox");
    fireEvent.change(composer, { target: { value: "注音輸入" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", keyCode: 229 });
    expect(client.executeConversationTurn).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("keeps the sent user message when the black circular stop control cancels generation", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.executeConversationTurn.mockImplementation((_documentId, _request, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("The request was aborted.", "AbortError")),
          { once: true },
        );
      }),
    );
    render(<Sheet open><SmartModePanel open /></Sheet>);

    const composer = await screen.findByRole("textbox");
    fireEvent.change(composer, { target: { value: "這是已送出的指令" } });
    fireEvent.click(screen.getByRole("button", { name: "smart.generate" }));

    expect(await within(screen.getByTestId("smart-mode-message-area")).findByText("這是已送出的指令")).toBeInTheDocument();
    const stop = screen.getByRole("button", { name: "smart.cancel" });
    expect(stop).toHaveClass("rounded-full", "bg-primary", "text-primary-foreground");
    expect(within(stop).getByTestId("smart-stop-icon")).toHaveClass("bg-primary-foreground");
    fireEvent.click(stop);
    await waitFor(() => expect(screen.queryByRole("button", { name: "smart.cancel" })).not.toBeInTheDocument());
    expect(within(screen.getByTestId("smart-mode-message-area")).getByText("這是已送出的指令")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    editor.destroy();
  });

  it("loads only the newest message page until the person explicitly asks for older messages", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.listConversations.mockResolvedValue({
      data: [{ id: "conversation-1", documentId: "doc-1", title: "Draft history", lastMessageAt: "2026-07-19T00:00:00.000Z", createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" }],
      nextCursor: null,
    });
    client.listConversationMessages
      .mockResolvedValueOnce({
        data: [{ id: "message-1", conversationId: "conversation-1", sequence: 1, role: "user", intent: "compose", content: "Latest question", createdAt: "2026-07-19T00:00:00.000Z" }],
        nextCursor: "older-page",
      })
      .mockResolvedValueOnce({ data: [], nextCursor: null });

    const user = userEvent.setup();
    render(<Sheet open><SmartModePanel open /></Sheet>);

    expect(await screen.findByText("Latest question")).toBeInTheDocument();
    expect(client.listConversationMessages).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "smart.loadEarlier" }));
    expect(client.listConversationMessages).toHaveBeenCalledTimes(2);
    expect(client.listConversationMessages).toHaveBeenLastCalledWith("doc-1", "conversation-1", "older-page");
    editor.destroy();
  });

  it("shows historical selection rewrites as previews without unsafe apply controls", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    client.listConversations.mockResolvedValue({
      data: [{ id: "conversation-1", documentId: "doc-1", title: "Rewrite history", lastMessageAt: "2026-07-19T00:00:00.000Z", createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" }],
      nextCursor: null,
    });
    client.listConversationMessages.mockResolvedValue({
      data: [{
        id: "message-2",
        conversationId: "conversation-1",
        sequence: 2,
        role: "assistant",
        intent: "rewrite-selection",
        content: "Rewrote the selected sentence.",
        createdAt: "2026-07-19T00:00:00.000Z",
        draft: {
          kind: "rewrite-selection",
          schemaVersion: "anvilnote.ai.rewrite-result.v1",
          replacement: {
            schemaVersion: "anvilnote.document.v1",
            type: "fragment",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Rewritten text" }] }],
          },
          changeSummary: "Rewrote the selected sentence.",
        },
      }],
      nextCursor: null,
    });

    render(<Sheet open><SmartModePanel open /></Sheet>);

    expect((await screen.findAllByText("Rewrote the selected sentence.")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "smart.insertAtCursor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "smart.replaceWholeDocument" })).not.toBeInTheDocument();
    editor.destroy();
  });

  it("closes the writing-style menu without closing the chat panel when blank chat space is clicked", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    const user = userEvent.setup();
    render(<Sheet open><SmartModePanel open /></Sheet>);

    await user.click(await screen.findByRole("button", { name: "writingStyle.label" }));
    expect(screen.getByText("writingStyle.label")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("smart-mode-message-area"));
    expect(screen.queryByText("writingStyle.label")).not.toBeInTheDocument();
    expect(screen.getByText("smart.title")).toBeInTheDocument();
    editor.destroy();
  });
});
