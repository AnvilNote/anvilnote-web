import type { AnvilDocument } from "@/types/document";
import type { ExportOptions, ExportPayload } from "@/types/export";
import { normalizeHeadingLevels } from "@/lib/tiptap/serialization";
import { formatIsoDate, resolveIsoDate } from "@/lib/date-format";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import type { AnvilMetadataValue } from "@/types/document";

// Templates only ever declare a metadata field's stored value as the plain
// "YYYY-MM-DD" wire format (see metadata-form.tsx) — this reformats each
// "date"-type field's value into the user's chosen display format (Settings
// > dateFormat) right before it's handed to the renderer, so the exported
// PDF shows e.g. "2026/07/07" instead of the raw ISO string every template's
// own Typst code would otherwise print verbatim.
function formatDateFields(
  metadata: Record<string, AnvilMetadataValue>,
  templateId: string,
): Record<string, AnvilMetadataValue> {
  const template = useTemplatesStore.getState().getTemplate(templateId);
  const dateKeys = new Set(
    (template?.fields ?? [])
      .filter((field) => field.scope === "metadata" && field.type === "date")
      .map((field) => field.key),
  );
  if (dateKeys.size === 0) return metadata;

  const dateFormat = useSettingsStore.getState().dateFormat;
  const next = { ...metadata };
  for (const key of dateKeys) {
    const value = next[key];
    if (typeof value === "string" && value) {
      next[key] = formatIsoDate(resolveIsoDate(value), dateFormat);
    }
  }
  return next;
}

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
    metadata: options.includeMetadata
      ? formatDateFields(doc.metadata, doc.templateId)
      : {},
    templateSettings: doc.templateSettings,
    numberedHeadings: doc.numberedHeadings,
    content: normalizeHeadingLevels(doc.content),
    sourceFormat: "tiptap-json",
    mathFormat: "latex",
    exportOptions: options,
  };
}
