import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  getProviders: vi.fn(),
  getCredentialStatus: vi.fn(),
  getCapabilities: vi.fn(),
  saveCredential: vi.fn(),
  listKeyProfiles: vi.fn(),
  saveKeyProfile: vi.fn(),
  renameKeyProfile: vi.fn(),
  activateKeyProfile: vi.fn(),
  deactivateKeyProfile: vi.fn(),
  deleteKeyProfile: vi.fn(),
  removeCredential: vi.fn(),
  testConnection: vi.fn(),
}));

const translate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

vi.mock("next-intl", () => ({ useTranslations: () => translate }));

vi.mock("@/lib/ai/runtime-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/runtime-client")>();
  return { ...original, aiClient: client };
});

import { AISettingsSection } from "./ai-settings-section";
import { useSettingsStore } from "@/lib/stores/settings-store";

const providerMetadata = {
  providers: [
    {
      id: "openai",
      displayName: "OpenAI",
      enabled: true,
      setupGuide: {
        titleKey: "ai.settings.openaiGuide.title",
        descriptionKey: "ai.settings.openaiGuide.description",
        documentationUrl: "https://platform.openai.com/api-keys",
        steps: [],
        notices: [],
      },
      models: [
        {
          id: "gpt-5.6-terra",
          providerId: "openai",
          displayName: "GPT-5.6 Terra",
          description: "Balanced",
          enabled: true,
          isDefault: true,
          capabilities: {
            structuredOutputs: true,
            textInput: true,
            imageInput: false,
            fileInput: false,
          },
          limits: {},
          pricingId: "gpt-5.6-terra",
          pricing: {
            inputPerMillionTokens: 2.5,
            cachedInputPerMillionTokens: 0.25,
            outputPerMillionTokens: 15,
            standardInputTokenLimit: 272_000,
          },
        },
      ],
    },
  ],
  defaultProviderId: "openai",
  defaultModelId: "gpt-5.6-terra",
  pricing: {
    version: "2026-07-18",
    currency: "USD" as const,
    source: "https://developers.openai.com/api/docs/models",
    approximate: true as const,
  },
  attachmentLimits: {
    maxFiles: 5,
    maxFileSizeBytes: 10_485_760,
    maxTotalSizeBytes: 26_214_400,
    maxCharactersPerFile: 100_000,
    maxTotalExtractedCharacters: 200_000,
  },
  capability: {
    runtime: "desktop" as const,
    persistentCredentialStorage: true,
    sessionCredentialStorage: false,
    smartModeAvailable: true,
  },
};

describe("AISettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      aiProviderId: "openai",
      aiModelId: "gpt-5.6-terra",
      aiHumanizerEnabled: true,
      aiWritingStyle: "auto",
    });
    client.getProviders.mockResolvedValue(providerMetadata);
    client.getCapabilities.mockResolvedValue(providerMetadata.capability);
    client.getCredentialStatus.mockResolvedValue({
      configured: false,
      storage: "os-secure-storage",
    });
    client.listKeyProfiles.mockResolvedValue([]);
  });

  it("shows only enabled OpenAI metadata and the Terra pricing", async () => {
    render(<AISettingsSection />);

    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
    expect(screen.getAllByText("GPT-5.6 Terra")).not.toHaveLength(0);
    expect(screen.getByText("US$2.50")).toBeInTheDocument();
    expect(screen.getByText("US$0.25")).toBeInTheDocument();
    expect(screen.getByText("US$15.00")).toBeInTheDocument();
    expect(screen.queryByText(/Claude|Gemini/)).not.toBeInTheDocument();
  });

  it("clears an unsaved key and only renders its masked status after saving", async () => {
    const user = userEvent.setup();
    client.saveKeyProfile.mockResolvedValue({
      id: "profile-1",
      providerId: "openai",
      label: "OpenAI",
      display: "OpenAI · sk-proj-****1234",
      isActive: true,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
    client.getCredentialStatus
      .mockResolvedValueOnce({ configured: false, storage: "os-secure-storage" })
      .mockResolvedValueOnce({ configured: true, lastFour: "1234", updatedAt: "2026-07-19T00:00:00.000Z", storage: "os-secure-storage" });
    render(<AISettingsSection />);

    const input = await screen.findByLabelText("settings.apiKey");
    await user.type(input, "sk-test-never-persist-1234");
    await user.click(screen.getByRole("button", { name: "settings.saveKey" }));

    await waitFor(() => expect(input).toHaveValue(""));
    expect(screen.getAllByText(/1234/).length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue("sk-test-never-persist-1234")).not.toBeInTheDocument();
  });

  it("shows only the fixed-mask profile metadata in desktop key management", async () => {
    client.listKeyProfiles.mockResolvedValue([{
      id: "profile-1",
      providerId: "openai",
      label: "Personal",
      display: "OpenAI · sk-proj-****1234",
      isActive: true,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    }]);

    render(<AISettingsSection />);

    expect(await screen.findByText("OpenAI · sk-proj-****1234")).toBeInTheDocument();
    expect(screen.queryByText(/encryptedSecret|sk-test-never-persist/)).not.toBeInTheDocument();
  });

  it("labels browser credential storage as session-only instead of saved", async () => {
    client.getCapabilities.mockResolvedValue({
      runtime: "browser",
      persistentCredentialStorage: false,
      sessionCredentialStorage: true,
      smartModeAvailable: true,
    });
    client.getCredentialStatus.mockResolvedValue({
      configured: false,
      storage: "session-only",
    });

    render(<AISettingsSection />);

    expect(
      await screen.findByRole("button", { name: "settings.useForSession" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "settings.saveKey" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the AI-phrasing toggle in collapsed advanced settings", async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);

    await screen.findByText("OpenAI");
    expect(screen.queryByRole("switch", { name: "settings.humanizer" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "settings.advanced" }));
    expect(screen.getByRole("switch", { name: "settings.humanizer" })).toBeChecked();
  });
});
