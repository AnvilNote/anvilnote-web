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
  createdAt: string;
  updatedAt: string;
};
