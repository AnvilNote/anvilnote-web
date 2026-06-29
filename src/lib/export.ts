import type { AnvilDocument } from "@/types/document";
import type { ExportOptions, ExportPayload } from "@/types/export";
import { normalizeHeadingLevels } from "@/lib/tiptap/serialization";

// The renderer-bound payload. Content stays as Tiptap JSON and math stays as
// LaTeX; the future anvilnote-renderer converts LaTeX → Typst on its side.
export function buildExportPayload(
  doc: AnvilDocument,
  options: ExportOptions,
): ExportPayload {
  return {
    documentId: doc.id,
    title: doc.title,
    templateId: doc.templateId,
    metadata: options.includeMetadata ? doc.metadata : {},
    templateSettings: doc.templateSettings,
    content: normalizeHeadingLevels(doc.content),
    sourceFormat: "tiptap-json",
    mathFormat: "latex",
    exportOptions: options,
  };
}
