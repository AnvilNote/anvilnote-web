export type TemplateFieldType =
  | "text"
  | "textarea"
  | "date"
  | "boolean"
  | "select"
  | "color";

export type TemplateFieldScope = "metadata" | "option";

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  // Which bucket the value belongs to: document metadata (kept across
  // templates) or template options (bound to the current template).
  scope: TemplateFieldScope;
  required?: boolean;
  default?: string | boolean;
  placeholder?: string;
  options?: string[];
  // Only render this field while another field (by key) holds `value` —
  // e.g. a link-color picker that only makes sense while colorlinks is on.
  dependsOn?: { key: string; value: AnvilMetadataValueLiteral };
};

// Kept separate from document.ts's AnvilMetadataValue to avoid a circular
// import; the two types must stay in sync.
type AnvilMetadataValueLiteral = string | boolean | null;

// Static preview assets live under public/template-previews/{id}/ and are
// generated offline by scripts/generate-template-previews.mjs.
export type TemplatePreview = {
  pdfUrl: string;
  thumbnailUrl: string;
  manifestUrl?: string;
  pageCount?: number;
};

// `id` holds the template slug (= renderer folder name = Document.templateId).
export type AnvilTemplate = {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  fields: TemplateField[];
  // This template's own content/text-column width, in cm — mirrors
  // anvilnote-api's own TemplateSummary field. Used by stats-chart's
  // "ratio of text width" custom sizing (see stats-chart-dialog.tsx).
  textWidthCm: number;
  // This template's own content/text-column HEIGHT, in cm — sibling to
  // textWidthCm above, same "page dimension minus this template's own
  // margins" derivation. Optional: only plain-note has a real measured
  // value so far (see anvilnote-renderer's templates/plain-note/
  // manifest.json) — every other template omits it, and question-block's
  // written-answer "blank space" percent-of-page-height feature simply
  // isn't available (falls back to null, see question.ts's
  // writtenHeightCm attr) wherever it's missing.
  textHeightCm?: number;
  // Optional: when omitted the preview is derived from `id` by convention.
  preview?: TemplatePreview;
  // Typst Universe page for the wrapped @preview package; absent for
  // self-authored/vendored templates (e.g. plain-note).
  universeUrl?: string;
};
