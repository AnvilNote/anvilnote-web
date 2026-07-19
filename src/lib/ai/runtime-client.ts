import {
  AIWriterResultSchema,
  type AIWriterRequest,
  type AIWriterResult,
  type AttachmentContext,
  type ConnectionTestResult,
} from "@anvilnote/ai-writer/contracts";
import type { AIProviderDefinition } from "@anvilnote/ai-writer/contracts";
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

type AIIPCResult<T> = { ok: true; data: T } | { ok: false; error: AIClientErrorShape };

interface DesktopAIBridge {
  getCapabilities(): Promise<AIIPCResult<AIRuntimeCapability>>;
  getCredentialStatus(providerId: string): Promise<AIIPCResult<AISecretStatus>>;
  saveCredential(
    providerId: string,
    apiKey: string,
  ): Promise<AIIPCResult<AISecretStatus>>;
  removeCredential(providerId: string): Promise<AIIPCResult<AISecretStatus>>;
  testConnection(input: {
    providerId: string;
    model: string;
    apiKey?: string;
  }): Promise<AIIPCResult<ConnectionTestResult>>;
  estimate(request: AIWriterRequest): Promise<AIIPCResult<unknown>>;
  execute(request: AIWriterRequest): Promise<AIIPCResult<AIWriterResult>>;
  cancel(requestId: string): Promise<AIIPCResult<void>>;
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
};
