import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/ui/sheet";
import { useEditorBridge } from "@/lib/stores/editor-bridge";

const client = vi.hoisted(() => ({
  getProviders: vi.fn(),
  getCredentialStatus: vi.fn(),
  estimate: vi.fn(),
  execute: vi.fn(),
  cancel: vi.fn(),
  extractAttachments: vi.fn(),
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
    client.getProviders.mockResolvedValue(metadata);
  });

  it("keeps the launcher workflow visible but blocks generation when no key is configured", async () => {
    const editor = createEditor();
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: false, storage: "session-only" });
    render(<Sheet open><SmartModePanel open onOpenChange={vi.fn()} /></Sheet>);

    expect(await screen.findByText("smart.notConfigured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "smart.generate" })).toBeDisabled();
    editor.destroy();
  });

  it("derives rewrite mode from the current selection without a mode selector", async () => {
    const editor = createEditor();
    editor.commands.setTextSelection({ from: 1, to: 9 });
    useEditorBridge.setState({ editor, documentId: "doc-1" });
    client.getCredentialStatus.mockResolvedValue({ configured: true, lastFour: "1234", storage: "os-secure-storage" });
    render(<Sheet open><SmartModePanel open onOpenChange={vi.fn()} /></Sheet>);

    expect(await screen.findByRole("button", { name: "smart.rewrite" })).toBeInTheDocument();
    expect(screen.queryByText(/Compose|Rewrite mode/)).not.toBeInTheDocument();
    editor.destroy();
  });
});
