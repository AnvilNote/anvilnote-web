import type {
  AIWriterIntent,
  AIWriterRequest,
  AttachmentContext,
  WritingStyle,
} from "@anvilnote/ai-writer/contracts";
import type {
  AnvilNoteDocumentFragmentV1,
  AnvilNoteDocumentV1,
} from "@anvilnote/ai-writer/document";

export function deriveWriterIntent(
  selectedContentPresent: boolean,
  attachmentCount: number,
): AIWriterIntent {
  if (selectedContentPresent) return "rewrite-selection";
  return attachmentCount > 0 ? "compose-from-attachments" : "compose";
}

export function buildSmartModeRequest(input: {
  requestId: string;
  model: string;
  instruction: string;
  locale: string;
  writingStyle: WritingStyle;
  humanizerEnabled: boolean;
  currentDocument?: AnvilNoteDocumentV1;
  selectedContent?: AnvilNoteDocumentFragmentV1;
  attachments: AttachmentContext[];
}): AIWriterRequest {
  const intent = deriveWriterIntent(Boolean(input.selectedContent), input.attachments.length);
  return {
    requestId: input.requestId,
    intent,
    provider: { id: "openai", model: input.model },
    instruction: input.instruction.trim(),
    context: {
      locale: input.locale,
      writingStyle: input.writingStyle,
      ...(input.currentDocument ? { currentDocument: input.currentDocument } : {}),
      ...(input.selectedContent ? { selectedContent: input.selectedContent } : {}),
      ...(input.attachments.length ? { attachments: input.attachments } : {}),
    },
    options: { humanizerEnabled: input.humanizerEnabled },
  };
}

