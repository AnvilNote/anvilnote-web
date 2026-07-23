import type { AnvilDocument } from "@/types/document";
import type { ExportOptions } from "@/types/export";
import { renderDocument } from "@/lib/api";
import { buildExportPayload } from "@/lib/export";

// Renders the CURRENT document's real content through a candidate template
// (which may differ from the document's own saved templateId) — used by the
// template picker's preview so "what would this look like" shows the user's
// actual document instead of a generic per-template sample. Doesn't persist
// anything: the override only lives in this one render request's payload.
export async function renderDocumentPreview(
  doc: AnvilDocument,
  templateId: string,
  options: ExportOptions,
): Promise<string | null> {
  const payload = { ...buildExportPayload(doc, options), templateId };
  const result = await renderDocument(doc.id, payload);
  return result.pdfUrl;
}
