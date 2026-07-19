import {
  AIWriterResultSchema,
  type AIWriterRequest,
  type AIWriterResult,
  type AttachmentContext,
  type ConnectionTestResult,
} from "@anvilnote/ai-writer/contracts";
import type { AIProviderDefinition } from "@anvilnote/ai-writer/contracts";
import type {
  AnvilNoteDocumentFragmentV1,
  AnvilNoteDocumentV1,
} from "@anvilnote/ai-writer/document";
import {
  getBrowserSessionCredential,
  getBrowserSessionCredentialStatus,
  removeBrowserSessionCredential,
  saveBrowserSessionCredential,
} from "./browser-session-credential";
import { getApiBaseUrl } from "@/lib/api";

export interface AIRuntimeCapability {
  runtime: "desktop" | "browser";
  persistentCredentialStorage: boolean;
  sessionCredentialStorage: boolean;
  smartModeAvailable: boolean;
  reason?: string;
}

export interface AISecretStatus {
  configured: boolean;
  lastFour?: string;
  updatedAt?: string;
  storage: "os-secure-storage" | "session-only" | "unavailable";
}

export interface AIProviderMetadata {
  providers: Array<
    Omit<AIProviderDefinition, "models"> & {
      models: Array<
        AIProviderDefinition["models"][number] & {
          pricing: {
            inputPerMillionTokens: number;
            cachedInputPerMillionTokens: number;
            outputPerMillionTokens: number;
            standardInputTokenLimit: number;
          } | null;
        }
      >;
    }
  >;
  defaultProviderId: string;
  defaultModelId: string;
  pricing: {
    version: string;
    currency: "USD";
    source: string;
    approximate: true;
  };
  attachmentLimits: {
    maxFiles: number;
    maxFileSizeBytes: number;
    maxTotalSizeBytes: number;
    maxCharactersPerFile: number;
    maxTotalExtractedCharacters: number;
  };
  capability: AIRuntimeCapability;
}

export interface AIWriterCostEstimate {
  tokenEstimate: {
    inputTokens: number;
    estimatedOutputTokensMin: number;
    estimatedOutputTokensMax: number;
    confidence: "high" | "medium" | "low";
  };
  cost: {
    currency: "USD";
    minimum: number;
    maximum: number;
    pricingVersion: string;
    approximate: true;
  } | null;
  pricingSource: string;
  approximate: true;
}

/** Safe metadata only: plaintext and encrypted key material never cross into
 * the renderer process. */
export interface AIKeyProfile {
  id: string;
  providerId: "openai";
  label: string;
  display: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AIConversationDraft =
  | {
      kind: "compose";
      schemaVersion: "anvilnote.ai.compose-result.v1";
      suggestedTitle: string | null;
      document: AnvilNoteDocumentV1;
      summary: string;
    }
  | {
      kind: "rewrite-selection";
      schemaVersion: "anvilnote.ai.rewrite-result.v1";
      replacement: AnvilNoteDocumentFragmentV1;
      changeSummary: string;
    };

export interface AIConversation {
  id: string;
  documentId: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversationMessage {
  id: string;
  conversationId: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  intent: AIWriterRequest["intent"];
  draft?: AIConversationDraft;
  attachments?: AIConversationAttachment[];
  createdAt: string;
}

export interface AIConversationAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PreparedAIConversationAttachment extends AIConversationAttachment {
  persisted: boolean;
}

export interface AICursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface AIConversationTurnRequest {
  requestId: string;
  conversationId?: string;
  intent?: AIWriterRequest["intent"];
  provider: AIWriterRequest["provider"];
  instruction: string;
  context: Pick<
    AIWriterRequest["context"],
    | "locale"
    | "requestedOutputLocale"
    | "documentType"
    | "writingStyle"
    | "selectedContent"
    | "attachments"
  >;
  options: AIWriterRequest["options"];
  attachmentIds?: string[];
}

export interface AIConversationTurnResult {
  conversation: AIConversation;
  messages: [AIConversationMessage, AIConversationMessage];
}

type AIIPCResult<T> = { ok: true; data: T } | { ok: false; error: AIClientErrorShape };

interface DesktopAIBridge {
  prepareAttachments(attachments: Array<{
    name: string;
    mimeType: string;
    data: ArrayBuffer;
  }>): Promise<AIIPCResult<PreparedAIConversationAttachment[]>>;
  getCapabilities(): Promise<AIIPCResult<AIRuntimeCapability>>;
  getCredentialStatus(providerId: string): Promise<AIIPCResult<AISecretStatus>>;
  saveCredential(
    providerId: string,
    apiKey: string,
  ): Promise<AIIPCResult<AISecretStatus>>;
  removeCredential(providerId: string): Promise<AIIPCResult<AISecretStatus>>;
  listKeyProfiles(providerId: string): Promise<AIIPCResult<AIKeyProfile[]>>;
  saveKeyProfile(input: {
    providerId: "openai";
    label: string;
    apiKey: string;
    isActive: boolean;
  }): Promise<AIIPCResult<AIKeyProfile>>;
  renameKeyProfile(profileId: string, label: string): Promise<AIIPCResult<AIKeyProfile>>;
  activateKeyProfile(profileId: string): Promise<AIIPCResult<AIKeyProfile>>;
  deactivateKeyProfile(profileId: string): Promise<AIIPCResult<AIKeyProfile>>;
  deleteKeyProfile(profileId: string): Promise<AIIPCResult<{ id: string }>>;
  testConnection(input: {
    providerId: string;
    model: string;
    apiKey?: string;
  }): Promise<AIIPCResult<ConnectionTestResult>>;
  estimate(request: AIWriterRequest): Promise<AIIPCResult<unknown>>;
  execute(request: AIWriterRequest): Promise<AIIPCResult<AIWriterResult>>;
  cancel(requestId: string): Promise<AIIPCResult<void>>;
  listConversations(
    documentId: string,
    cursor?: string,
  ): Promise<AIIPCResult<AICursorPage<AIConversation>>>;
  listConversationMessages(
    documentId: string,
    conversationId: string,
    cursor?: string,
  ): Promise<AIIPCResult<AICursorPage<AIConversationMessage>>>;
  executeConversationTurn(
    documentId: string,
    request: AIConversationTurnRequest,
  ): Promise<AIIPCResult<AIConversationTurnResult>>;
  renameConversation(
    documentId: string,
    conversationId: string,
    title: string,
  ): Promise<AIIPCResult<AIConversation>>;
  deleteConversation(
    documentId: string,
    conversationId: string,
  ): Promise<AIIPCResult<{ id: string }>>;
}

export interface AIClientErrorShape {
  code: string;
  messageKey: string;
  retryable: boolean;
  requestId?: string;
  details?: Record<string, unknown>;
}

export class AIClientError extends Error {
  constructor(readonly shape: AIClientErrorShape) {
    super(shape.messageKey);
    this.name = "AIClientError";
  }
}

function desktopBridge() {
  if (typeof window === "undefined") return undefined;
  return (
    window.anvilnote as
      | (NonNullable<typeof window.anvilnote> & { ai?: DesktopAIBridge })
      | undefined
  )?.ai;
}

function unwrapIPC<T>(result: AIIPCResult<T>): T {
  if (!result.ok) throw new AIClientError(result.error);
  return result.data;
}

async function jsonRequest<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object" || !("data" in payload)) {
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error: AIClientErrorShape }).error
        : {
            code: "network_error",
            messageKey: "ai.errors.network_error",
            retryable: true,
          };
    throw new AIClientError(error);
  }
  return (payload as { data: T }).data;
}

async function cursorPageRequest<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<AICursorPage<T>> {
  const response = await fetch(`${getApiBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object" || !("data" in payload)) {
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error: AIClientErrorShape }).error
        : {
            code: "network_error",
            messageKey: "ai.errors.network_error",
            retryable: true,
          };
    throw new AIClientError(error);
  }
  const record = payload as { data: T[]; meta?: { nextCursor?: unknown } };
  return {
    data: record.data,
    nextCursor: typeof record.meta?.nextCursor === "string" ? record.meta.nextCursor : null,
  };
}

export const aiClient = {
  async getProviders(): Promise<AIProviderMetadata> {
    return jsonRequest<AIProviderMetadata>("/api/ai/providers");
  },

  async getCapabilities(): Promise<AIRuntimeCapability> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.getCapabilities());
    return (await aiClient.getProviders()).capability;
  },

  async getCredentialStatus(): Promise<AISecretStatus> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.getCredentialStatus("openai"));
    return getBrowserSessionCredentialStatus();
  },

  async saveCredential(apiKey: string): Promise<AISecretStatus> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.saveCredential("openai", apiKey));
    const capability = await aiClient.getCapabilities();
    if (!capability.sessionCredentialStorage) {
      throw new AIClientError({
        code: "secure_storage_unavailable",
        messageKey: "ai.errors.browser_unavailable",
        retryable: false,
      });
    }
    return saveBrowserSessionCredential(apiKey);
  },

  async removeCredential(): Promise<AISecretStatus> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.removeCredential("openai"));
    return removeBrowserSessionCredential();
  },

  async listKeyProfiles(): Promise<AIKeyProfile[]> {
    const bridge = desktopBridge();
    if (!bridge) return [];
    return unwrapIPC(await bridge.listKeyProfiles("openai"));
  },

  async saveKeyProfile(input: {
    label: string;
    apiKey: string;
    isActive: boolean;
  }): Promise<AIKeyProfile> {
    const bridge = desktopBridge();
    if (!bridge) {
      throw new AIClientError({
        code: "secure_storage_unavailable",
        messageKey: "ai.errors.browser_unavailable",
        retryable: false,
      });
    }
    return unwrapIPC(await bridge.saveKeyProfile({ providerId: "openai", ...input }));
  },

  async renameKeyProfile(profileId: string, label: string): Promise<AIKeyProfile> {
    const bridge = desktopBridge();
    if (!bridge) throw new AIClientError({ code: "permission_denied", messageKey: "ai.errors.permission_denied", retryable: false });
    return unwrapIPC(await bridge.renameKeyProfile(profileId, label));
  },

  async activateKeyProfile(profileId: string): Promise<AIKeyProfile> {
    const bridge = desktopBridge();
    if (!bridge) throw new AIClientError({ code: "permission_denied", messageKey: "ai.errors.permission_denied", retryable: false });
    return unwrapIPC(await bridge.activateKeyProfile(profileId));
  },

  async deactivateKeyProfile(profileId: string): Promise<AIKeyProfile> {
    const bridge = desktopBridge();
    if (!bridge) throw new AIClientError({ code: "permission_denied", messageKey: "ai.errors.permission_denied", retryable: false });
    return unwrapIPC(await bridge.deactivateKeyProfile(profileId));
  },

  async deleteKeyProfile(profileId: string): Promise<{ id: string }> {
    const bridge = desktopBridge();
    if (!bridge) throw new AIClientError({ code: "permission_denied", messageKey: "ai.errors.permission_denied", retryable: false });
    return unwrapIPC(await bridge.deleteKeyProfile(profileId));
  },

  async testConnection(input: {
    providerId: string;
    model: string;
    apiKey?: string;
  }): Promise<ConnectionTestResult> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.testConnection(input));
    const credential = input.apiKey?.trim() || getBrowserSessionCredential();
    if (!credential) {
      throw new AIClientError({
        code: "invalid_api_key",
        messageKey: "ai.errors.invalid_api_key",
        retryable: false,
      });
    }
    return jsonRequest<ConnectionTestResult>("/api/ai/test-connection", {
      method: "POST",
      headers: { "x-anvilnote-ai-credential": credential },
      body: JSON.stringify({ providerId: input.providerId, model: input.model }),
    });
  },

  async extractAttachments(files: File[], signal?: AbortSignal): Promise<AttachmentContext[]> {
    const body = new FormData();
    files.forEach((file) => body.append("files", file, file.name));
    return jsonRequest<AttachmentContext[]>("/api/ai/attachments/extract", {
      method: "POST",
      body,
      signal,
    });
  },

  async prepareAttachments(files: File[]): Promise<PreparedAIConversationAttachment[]> {
    const bridge = desktopBridge();
    if (!bridge) {
      return files.map((file) => ({
        id: crypto.randomUUID(),
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        persisted: false,
      }));
    }
    const inputs = await Promise.all(files.map(async (file) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data: await file.arrayBuffer(),
    })));
    return unwrapIPC(await bridge.prepareAttachments(inputs));
  },

  async estimate(request: AIWriterRequest): Promise<AIWriterCostEstimate> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.estimate(request)) as AIWriterCostEstimate;
    return jsonRequest<AIWriterCostEstimate>("/api/ai/estimate", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async execute(request: AIWriterRequest, signal?: AbortSignal): Promise<AIWriterResult> {
    const bridge = desktopBridge();
    if (bridge) {
      const cancel = () => void bridge.cancel(request.requestId);
      signal?.addEventListener("abort", cancel, { once: true });
      try {
        const result = unwrapIPC<AIWriterResult>(await bridge.execute(request));
        if (signal?.aborted) {
          throw new AIClientError({
            code: "request_cancelled",
            messageKey: "ai.errors.request_cancelled",
            retryable: false,
          });
        }
        return AIWriterResultSchema.parse(result);
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
    }
    const credential = getBrowserSessionCredential();
    if (!credential) {
      throw new AIClientError({
        code: "invalid_api_key",
        messageKey: "ai.errors.invalid_api_key",
        retryable: false,
      });
    }
    const pathname =
      request.intent === "rewrite-selection"
        ? "/api/ai/rewrite-selection"
        : "/api/ai/compose";
    return AIWriterResultSchema.parse(
      await jsonRequest(pathname, {
        method: "POST",
        headers: { "x-anvilnote-ai-credential": credential },
        body: JSON.stringify(request),
        signal,
      }),
    );
  },

  async cancel(requestId: string): Promise<void> {
    const bridge = desktopBridge();
    if (bridge) await bridge.cancel(requestId);
  },

  async listConversations(
    documentId: string,
    cursor?: string,
  ): Promise<AICursorPage<AIConversation>> {
    const bridge = desktopBridge();
    if (bridge) {
      return unwrapIPC(await bridge.listConversations(documentId, cursor));
    }
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return cursorPageRequest<AIConversation>(
      `/api/documents/${encodeURIComponent(documentId)}/ai-conversations${query}`,
    );
  },

  async listConversationMessages(
    documentId: string,
    conversationId: string,
    cursor?: string,
  ): Promise<AICursorPage<AIConversationMessage>> {
    const bridge = desktopBridge();
    if (bridge) {
      return unwrapIPC(await bridge.listConversationMessages(documentId, conversationId, cursor));
    }
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return cursorPageRequest<AIConversationMessage>(
      `/api/documents/${encodeURIComponent(documentId)}/ai-conversations/${encodeURIComponent(conversationId)}/messages${query}`,
    );
  },

  async executeConversationTurn(
    documentId: string,
    request: AIConversationTurnRequest,
    signal?: AbortSignal,
  ): Promise<AIConversationTurnResult> {
    const bridge = desktopBridge();
    if (bridge) {
      const cancel = () => void bridge.cancel(request.requestId);
      signal?.addEventListener("abort", cancel, { once: true });
      try {
        return unwrapIPC(await bridge.executeConversationTurn(documentId, request));
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
    }
    const credential = getBrowserSessionCredential();
    if (!credential) {
      throw new AIClientError({
        code: "invalid_api_key",
        messageKey: "ai.errors.invalid_api_key",
        retryable: false,
      });
    }
    const browserRequest = { ...request };
    delete browserRequest.attachmentIds;
    return jsonRequest<AIConversationTurnResult>(
      `/api/documents/${encodeURIComponent(documentId)}/ai-conversations/turns`,
      {
        method: "POST",
        headers: { "x-anvilnote-ai-credential": credential },
        body: JSON.stringify(browserRequest),
        signal,
      },
    );
  },

  async renameConversation(
    documentId: string,
    conversationId: string,
    title: string,
  ): Promise<AIConversation> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.renameConversation(documentId, conversationId, title));
    return jsonRequest<AIConversation>(
      `/api/documents/${encodeURIComponent(documentId)}/ai-conversations/${encodeURIComponent(conversationId)}`,
      { method: "PATCH", body: JSON.stringify({ title }) },
    );
  },

  async deleteConversation(documentId: string, conversationId: string): Promise<{ id: string }> {
    const bridge = desktopBridge();
    if (bridge) return unwrapIPC(await bridge.deleteConversation(documentId, conversationId));
    return jsonRequest<{ id: string }>(
      `/api/documents/${encodeURIComponent(documentId)}/ai-conversations/${encodeURIComponent(conversationId)}`,
      { method: "DELETE" },
    );
  },
};
