import type { AISecretStatus } from "./runtime-client";

let openAIKey: { value: string; updatedAt: string } | null = null;

export function saveBrowserSessionCredential(secretInput: string): AISecretStatus {
  const secret = secretInput.trim();
  if (!secret || secret.length > 4096) throw new Error("invalid_api_key");
  openAIKey = { value: secret, updatedAt: new Date().toISOString() };
  return getBrowserSessionCredentialStatus();
}

export function getBrowserSessionCredential(): string | null {
  return openAIKey?.value ?? null;
}

export function getBrowserSessionCredentialStatus(): AISecretStatus {
  return openAIKey
    ? {
        configured: true,
        lastFour: openAIKey.value.slice(-4),
        updatedAt: openAIKey.updatedAt,
        storage: "session-only",
      }
    : { configured: false, storage: "session-only" };
}

export function removeBrowserSessionCredential(): AISecretStatus {
  openAIKey = null;
  return getBrowserSessionCredentialStatus();
}
