import type { JSONContent } from "@tiptap/core";
import type { AnvilMetadataValue } from "./document";

export type ExportPageSize = "A4" | "Letter";
export type ExportFontPreset = "sans" | "serif" | "mono";
export type ExportFormat = "pdf" | "markdown" | "docx";

export type ExportOptions = {
  pageSize: ExportPageSize;
  fontPreset: ExportFontPreset;
  includeMetadata: boolean;
};

// The payload handed to the future anvilnote-renderer. Math stays as LaTeX
// (mathFormat: "latex"); the renderer converts LaTeX → Typst math on its side.
// AnvilNote web never converts to Typst.
export type ExportPayload = {
  documentId: string;
  title: string;
  templateId: string;
  metadata: Record<string, AnvilMetadataValue>;
  templateSettings: Record<string, AnvilMetadataValue>;
  content: JSONContent;
  sourceFormat: "tiptap-json";
  mathFormat: "latex";
  exportOptions: ExportOptions;
};
