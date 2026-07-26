const AI_MESSAGE_PREFIX = "ai.";
const AI_ERROR_PREFIX = "ai.errors.";

export function inlineAIErrorMessageKey(error: unknown): string {
  const value = error instanceof Error ? error.message : "unknown_error";
  if (value.startsWith(AI_MESSAGE_PREFIX)) return value;
  const code = value.trim() || "unknown_error";
  return `${AI_ERROR_PREFIX}${code}`;
}
