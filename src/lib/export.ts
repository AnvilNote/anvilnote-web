import type { AnvilDocument } from "@/types/document";
import type { ExportOptions, ExportPayload } from "@/types/export";

export function buildExportPayload(
  doc: AnvilDocument,
  options: ExportOptions,
): ExportPayload {
  return {
    documentId: doc.id,
    title: doc.title,
    templateId: doc.templateId,
    metadata: options.includeMetadata ? doc.metadata : {},
    blocks: doc.blocks,
    exportOptions: options,
  };
}
