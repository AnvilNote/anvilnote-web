import type { JSONContent } from "@tiptap/core";

export type AnvilMetadataValue = string | boolean | null;

export type AnvilDocument = {
  id: string;
  title: string;
  icon?: string;
  // Canonical frontend document source: Tiptap JSON (a `doc` node). Math is
  // stored as inlineMath / blockMath nodes carrying a LaTeX `latex` attr.
  content: JSONContent;
  templateId: string;
  // Document Metadata: kept across templates (title/author/date/courseName…).
  metadata: Record<string, AnvilMetadataValue>;
  // Template Options: bound to the current template (toc/paperSize…).
  templateSettings: Record<string, AnvilMetadataValue>;
  // Document-level, template-independent: whether PDF export shows
  // "1"/"1.1"-style heading numbers. Deliberately NOT part of
  // templateSettings — it applies uniformly regardless of which template is
  // active (only plain-note's own adapter chain currently acts on it).
  numberedHeadings: boolean;
  // Optional grouping; null means the document is unfiled.
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

// A point-in-time snapshot of a document, for version history. Summaries
// (list view) omit `content` — it can be large (inline base64 images) and
// isn't needed until a specific version is actually opened.
export type AnvilDocumentVersionSummary = {
  id: string;
  documentId: string;
  title: string;
  createdAt: string;
};

export type AnvilDocumentVersion = AnvilDocumentVersionSummary & {
  content: JSONContent;
  metadata: Record<string, AnvilMetadataValue>;
  templateSettings: Record<string, AnvilMetadataValue>;
};
