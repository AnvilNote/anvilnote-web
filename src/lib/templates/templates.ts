import type { AnvilTemplate, TemplateField } from "@/types/template";
import type { AnvilMetadataValue } from "@/types/document";

/**
 * Template definitions are frontend-only data. User-facing strings
 * (template names, descriptions, field labels, option labels) are stored
 * as i18n message keys and resolved in the UI, never hardcoded in markup.
 *
 * label      -> `templates.fields.<key>`
 * placeholder -> `templates.placeholders.<key>`
 * option value -> resolved via `templates.options.<value>`
 */

function field(
  key: string,
  type: TemplateField["type"],
  required = false,
  extra: Partial<TemplateField> = {},
): TemplateField {
  return {
    key,
    label: `fields.${key}`,
    type,
    required,
    placeholder: type === "text" || type === "date" ? `placeholders.${key}` : undefined,
    ...extra,
  };
}

export const TEMPLATES: AnvilTemplate[] = [
  {
    id: "plain-note",
    name: "items.plain-note.name",
    description: "items.plain-note.description",
    category: "note",
    fields: [],
  },
  {
    id: "lecture-note",
    name: "items.lecture-note.name",
    description: "items.lecture-note.description",
    category: "lecture",
    fields: [
      field("course", "text", true),
      field("lecturer", "text"),
      field("date", "date"),
      field("topic", "text"),
    ],
  },
  {
    id: "academic-handout",
    name: "items.academic-handout.name",
    description: "items.academic-handout.description",
    category: "academic",
    fields: [
      field("author", "text", true),
      field("institution", "text"),
      field("date", "date"),
      field("level", "select", false, {
        options: ["undergraduate", "graduate", "seminar"],
        defaultValue: "undergraduate",
      }),
      field("abstract", "text"),
      field("draft", "boolean", false, { defaultValue: false }),
    ],
  },
  {
    id: "problem-set",
    name: "items.problem-set.name",
    description: "items.problem-set.description",
    category: "teaching",
    fields: [
      field("course", "text", true),
      field("instructor", "text"),
      field("dueDate", "date"),
      field("difficulty", "select", false, {
        options: ["easy", "medium", "hard"],
        defaultValue: "medium",
      }),
      field("showSolutions", "boolean", false, { defaultValue: false }),
    ],
  },
  {
    id: "reading-note",
    name: "items.reading-note.name",
    description: "items.reading-note.description",
    category: "note",
    fields: [
      field("source", "text", true),
      field("author", "text"),
      field("date", "date"),
      field("pages", "text"),
      field("recommended", "boolean", false, { defaultValue: false }),
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = "lecture-note";

export function getTemplate(id: string): AnvilTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Build a metadata object for a template, seeding default values. */
export function buildDefaultMetadata(
  templateId: string,
  existing: Record<string, AnvilMetadataValue> = {},
): Record<string, AnvilMetadataValue> {
  const template = getTemplate(templateId);
  const next: Record<string, AnvilMetadataValue> = {};
  for (const f of template.fields) {
    if (f.key in existing) {
      next[f.key] = existing[f.key];
    } else if (f.defaultValue !== undefined) {
      next[f.key] = f.defaultValue ?? null;
    } else {
      next[f.key] = f.type === "boolean" ? false : "";
    }
  }
  return next;
}
