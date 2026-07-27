const UNKNOWN_ERROR_KEY = "ai.errors.unknown_error";

const AI_ERROR_KEYS = new Set([
  "ai.errors.attachment_parse_failed",
  "ai.errors.browser_unavailable",
  "ai.errors.context_length_exceeded",
  "ai.errors.conversion_failed",
  "ai.errors.editor_unavailable",
  "ai.errors.incomplete_response",
  "ai.errors.insufficient_credit",
  "ai.errors.invalid_api_key",
  "ai.errors.invalid_request",
  "ai.errors.invalid_request_schema",
  "ai.errors.invalid_structured_output",
  "ai.errors.model_unavailable",
  "ai.errors.multi_paragraph_result",
  "ai.errors.network_error",
  "ai.errors.password_protected_pdf",
  "ai.errors.permission_denied",
  "ai.errors.provider_error",
  "ai.errors.provider_refusal",
  "ai.errors.provider_timeout",
  "ai.errors.rate_limited",
  "ai.errors.request_cancelled",
  "ai.errors.request_too_large",
  "ai.errors.secure_storage_unavailable",
  "ai.errors.selection_conflict",
  UNKNOWN_ERROR_KEY,
  "ai.errors.unsupported_attachment",
  "ai.errors.unsupported_selection",
]);

const AI_EDIT_ERROR_KEYS = new Set([
  "ai.edits.errors.invalid_edit_operation",
  "ai.edits.errors.invalid_reference",
  "ai.edits.errors.request_too_large",
  "ai.edits.errors.stale_document",
  "ai.edits.errors.unsupported_image_edit",
]);

export function inlineAIErrorMessageKey(error: unknown): string {
  const value = error instanceof Error ? error.message.trim() : "";
  if (AI_ERROR_KEYS.has(value) || AI_EDIT_ERROR_KEYS.has(value)) return value;

  const qualifiedLocalKey = `ai.errors.${value}`;
  return AI_ERROR_KEYS.has(qualifiedLocalKey)
    ? qualifiedLocalKey
    : UNKNOWN_ERROR_KEY;
}
