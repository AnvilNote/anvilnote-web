import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSmartModeUIStore } from "@/lib/stores/smart-mode-ui-store";

const client = vi.hoisted(() => ({ executeConversationTurn: vi.fn() }));

vi.mock("next-intl", () => ({
  useLocale: () => "zh-TW",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/lib/ai/runtime-client", () => ({ aiClient: client }));
vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children, className, pluginKey }: {
    children: React.ReactNode;
    className?: string;
    pluginKey?: string;
  }) => <div data-plugin-key={pluginKey} className={className}>{children}</div>,
}));

import { TiptapBubbleMenu } from "./tiptap-bubble-menu";

function createEditor() {
  const editor = new Editor({
    extensions: [StarterKit],
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Selected ordinary text" }] }],
    },
  });
  editor.commands.setTextSelection({ from: 1, to: 9 });
  return editor;
}

describe("TiptapBubbleMenu inline Smart Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSmartModeUIStore.setState({
      open: false,
      activeConversationByDocument: {},
      inlineFallbackInstructionByDocument: {},
      conversationVersion: 0,
    });
  });

  it("keeps both the rounded inline composer and the marked source selection", () => {
    const editor = createEditor();
    render(
      <TiptapBubbleMenu
        editor={editor}
        documentId="doc-1"
        onInsertMath={vi.fn()}
        onEditLink={vi.fn()}
        onEditColor={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "smart.inline" }));

    const composer = screen.getByRole("textbox");
    expect(composer.parentElement).toHaveClass("rounded-full");
    expect(editor.view.dom.querySelector(".anvil-ai-inline-selection")?.textContent).toBe("Selected");
    expect(useSmartModeUIStore.getState().open).toBe(false);
    editor.destroy();
  });

  it("keeps a non-inline provider result in the inline composer instead of opening the right panel", async () => {
    client.executeConversationTurn.mockResolvedValue({
      conversation: {
        id: "conversation-1",
        documentId: "doc-1",
        title: "Rewrite",
        lastMessageAt: "2026-07-19T00:00:00.000Z",
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      },
      messages: [
        {
          id: "message-1",
          conversationId: "conversation-1",
          sequence: 1,
          role: "user",
          intent: "rewrite-selection",
          content: "Rewrite",
          createdAt: "2026-07-19T00:00:00.000Z",
        },
        {
          id: "message-2",
          conversationId: "conversation-1",
          sequence: 2,
          role: "assistant",
          intent: "rewrite-selection",
          content: "Draft",
          createdAt: "2026-07-19T00:00:00.000Z",
          draft: {
            kind: "rewrite-selection",
            schemaVersion: "anvilnote.ai.rewrite-result.v1",
            replacement: {
              schemaVersion: "anvilnote.fragment.v1",
              type: "fragment",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "First" }] },
                { type: "paragraph", content: [{ type: "text", text: "Second" }] },
              ],
            },
            changeSummary: "Split the text",
          },
        },
      ],
    });
    const editor = createEditor();
    render(
      <TiptapBubbleMenu
        editor={editor}
        documentId="doc-1"
        onInsertMath={vi.fn()}
        onEditLink={vi.fn()}
        onEditColor={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "smart.inline" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Rewrite this" } });
    fireEvent.click(screen.getByRole("button", { name: "smart.rewrite" }));

    await waitFor(() => expect(client.executeConversationTurn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useSmartModeUIStore.getState().open).toBe(false));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(editor.view.dom.querySelector(".anvil-ai-inline-selection")?.textContent).toBe("Selected");
    editor.destroy();
  });

  it("shows a fully-qualified provider error inline without duplicating its translation namespace", async () => {
    client.executeConversationTurn.mockRejectedValue(new Error("ai.errors.provider_error"));
    const editor = createEditor();
    render(
      <TiptapBubbleMenu
        editor={editor}
        documentId="doc-1"
        onInsertMath={vi.fn()}
        onEditLink={vi.fn()}
        onEditColor={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "smart.inline" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Rewrite this" } });
    fireEvent.click(screen.getByRole("button", { name: "smart.rewrite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("errors.provider_error");
    expect(screen.queryByText("errors.ai.errors.provider_error")).not.toBeInTheDocument();
    expect(useSmartModeUIStore.getState().open).toBe(false);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    editor.destroy();
  });

  it("uses the original BubbleMenu for review and returns a rejected draft to the preserved instruction", async () => {
    client.executeConversationTurn.mockResolvedValue({
      conversation: {
        id: "conversation-1",
        documentId: "doc-1",
        title: "Rewrite",
        lastMessageAt: "2026-07-19T00:00:00.000Z",
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      },
      messages: [
        {
          id: "message-1",
          conversationId: "conversation-1",
          sequence: 1,
          role: "user",
          intent: "rewrite-selection",
          content: "Make this clearer",
          createdAt: "2026-07-19T00:00:00.000Z",
        },
        {
          id: "message-2",
          conversationId: "conversation-1",
          sequence: 2,
          role: "assistant",
          intent: "rewrite-selection",
          content: "Draft",
          createdAt: "2026-07-19T00:00:00.000Z",
          draft: {
            kind: "rewrite-selection",
            schemaVersion: "anvilnote.ai.rewrite-result.v1",
            replacement: {
              schemaVersion: "anvilnote.fragment.v1",
              type: "fragment",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Clearer text" }] }],
            },
            changeSummary: "Clarified the sentence",
          },
        },
      ],
    });
    const editor = createEditor();
    const { container } = render(
      <TiptapBubbleMenu
        editor={editor}
        documentId="doc-1"
        onInsertMath={vi.fn()}
        onEditLink={vi.fn()}
        onEditColor={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "smart.inline" }));
    fireEvent.change(screen.getByPlaceholderText("smart.inlinePlaceholder"), {
      target: { value: "Make this clearer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "smart.rewrite" }));

    const formattingMenu = container.querySelector(
      '[data-plugin-key="anvilnote-formatting-bubble"]',
    );
    expect(formattingMenu).not.toBeNull();
    expect(await within(formattingMenu as HTMLElement).findByRole("button", { name: "smart.accept" })).toBeInTheDocument();
    expect(within(formattingMenu as HTMLElement).getByRole("button", { name: "smart.reject" })).toBeInTheDocument();

    fireEvent.click(within(formattingMenu as HTMLElement).getByRole("button", { name: "smart.reject" }));

    expect(screen.getByRole("textbox")).toHaveValue("Make this clearer");
    expect(screen.getByRole("textbox").parentElement).toHaveClass("rounded-full");
    expect(editor.view.dom.querySelector(".anvil-ai-inline-selection")?.textContent).toBe("Selected");
    expect(useSmartModeUIStore.getState().open).toBe(false);
    editor.destroy();
  });

  it("collapses the accepted replacement and clears every inline selection or diff mark", async () => {
    client.executeConversationTurn.mockResolvedValue({
      conversation: {
        id: "conversation-1",
        documentId: "doc-1",
        title: "Rewrite",
        lastMessageAt: "2026-07-19T00:00:00.000Z",
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      },
      messages: [
        {
          id: "message-1",
          conversationId: "conversation-1",
          sequence: 1,
          role: "user",
          intent: "rewrite-selection",
          content: "Make this clearer",
          createdAt: "2026-07-19T00:00:00.000Z",
        },
        {
          id: "message-2",
          conversationId: "conversation-1",
          sequence: 2,
          role: "assistant",
          intent: "rewrite-selection",
          content: "Draft",
          createdAt: "2026-07-19T00:00:00.000Z",
          draft: {
            kind: "rewrite-selection",
            schemaVersion: "anvilnote.ai.rewrite-result.v1",
            replacement: {
              schemaVersion: "anvilnote.fragment.v1",
              type: "fragment",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Clearer" }] }],
            },
            changeSummary: "Clarified the text",
          },
        },
      ],
    });
    const editor = createEditor();
    document.body.appendChild(editor.view.dom);
    render(
      <TiptapBubbleMenu
        editor={editor}
        documentId="doc-1"
        onInsertMath={vi.fn()}
        onEditLink={vi.fn()}
        onEditColor={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "smart.inline" }));
    fireEvent.change(screen.getByPlaceholderText("smart.inlinePlaceholder"), {
      target: { value: "Make this clearer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "smart.rewrite" }));
    fireEvent.click(await screen.findByRole("button", { name: "smart.accept" }));

    await waitFor(() => {
      expect(editor.state.selection.from).toBe(editor.state.selection.to);
      expect(editor.isFocused).toBe(true);
    });
    expect(editor.view.dom.querySelector(".anvil-ai-inline-selection")).toBeNull();
    expect(editor.view.dom.querySelector(".anvil-ai-inline-original")).toBeNull();
    expect(editor.view.dom.querySelector(".anvil-ai-inline-replacement")).toBeNull();
    expect(editor.getText()).toContain("Clearer");
    editor.destroy();
  });

  it("applies a multi-paragraph reply when the whole paragraph was selected", async () => {
    client.executeConversationTurn.mockResolvedValue({
      conversation: {
        id: "conversation-1",
        documentId: "doc-1",
        title: "Rewrite",
        lastMessageAt: "2026-07-19T00:00:00.000Z",
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      },
      messages: [
        {
          id: "message-1",
          conversationId: "conversation-1",
          sequence: 1,
          role: "user",
          intent: "rewrite-selection",
          content: "Expand this",
          createdAt: "2026-07-19T00:00:00.000Z",
        },
        {
          id: "message-2",
          conversationId: "conversation-1",
          sequence: 2,
          role: "assistant",
          intent: "rewrite-selection",
          content: "Draft",
          createdAt: "2026-07-19T00:00:00.000Z",
          draft: {
            kind: "rewrite-selection",
            schemaVersion: "anvilnote.ai.rewrite-result.v1",
            replacement: {
              schemaVersion: "anvilnote.fragment.v1",
              type: "fragment",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "First half" }] },
                { type: "paragraph", content: [{ type: "text", text: "Second half" }] },
              ],
            },
            changeSummary: "Split into two paragraphs",
          },
        },
      ],
    });
    const editor = new Editor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Selected ordinary text" }] }],
      },
    });
    // The whole paragraph's content (not a partial sub-range) is selected.
    editor.commands.setTextSelection({ from: 1, to: 1 + "Selected ordinary text".length });
    document.body.appendChild(editor.view.dom);
    render(
      <TiptapBubbleMenu
        editor={editor}
        documentId="doc-1"
        onInsertMath={vi.fn()}
        onEditLink={vi.fn()}
        onEditColor={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "smart.inline" }));
    fireEvent.change(screen.getByPlaceholderText("smart.inlinePlaceholder"), {
      target: { value: "Expand this into two paragraphs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "smart.rewrite" }));
    fireEvent.click(await screen.findByRole("button", { name: "smart.accept" }));

    await waitFor(() => {
      expect(editor.getJSON().content).toEqual([
        { type: "paragraph", content: [{ type: "text", text: "First half" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second half" }] },
      ]);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    editor.destroy();
  });
});
