import type { AnvilTemplate, TemplateField } from "@/types/template";
import type { AnvilMetadataValue } from "@/types/document";

// Templates are no longer hard-coded here — they come from the API (which reads
// the renderer's manifests). This module only holds the default slug and the
// scope-aware seeding helpers used when creating a document or switching
// templates.

export const DEFAULT_TEMPLATE_ID = "plain-note";

function seedValue(field: TemplateField): AnvilMetadataValue {
  if (field.default !== undefined) {
    return field.default;
  }
  return field.type === "boolean" ? false : "";
}

function seedBucket(
  template: AnvilTemplate | undefined,
  scope: TemplateField["scope"],
  existing: Record<string, AnvilMetadataValue>,
): Record<string, AnvilMetadataValue> {
  const next: Record<string, AnvilMetadataValue> = {};
  if (!template) {
    return next;
  }
  for (const field of template.fields) {
    if (field.scope !== scope) {
      continue;
    }
    next[field.key] = field.key in existing ? existing[field.key] : seedValue(field);
  }
  return next;
}

/** Document metadata seeded from a template's metadata-scoped fields. */
export function seedMetadata(
  template: AnvilTemplate | undefined,
  existing: Record<string, AnvilMetadataValue> = {},
): Record<string, AnvilMetadataValue> {
  return seedBucket(template, "metadata", existing);
}

/** Template options seeded from a template's option-scoped fields. */
export function seedTemplateSettings(
  template: AnvilTemplate | undefined,
  existing: Record<string, AnvilMetadataValue> = {},
): Record<string, AnvilMetadataValue> {
  return seedBucket(template, "option", existing);
}
