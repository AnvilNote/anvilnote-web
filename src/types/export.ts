import type { JSONContent } from "@tiptap/core";
import type { AnvilMetadataValue } from "./document";
import type { OrderedModuleId, UnorderedSymbol } from "@/lib/list-markers/marker-modules";

export type ExportPageSize = "A4" | "Letter";
export type ExportFontPreset = "sans" | "serif" | "mono";
export type ExportFormat = "pdf" | "markdown" | "docx" | "json" | "anvilnote";

export type ExportOptions = {
  pageSize: ExportPageSize;
  fontPreset: ExportFontPreset;
  includeMetadata: boolean;
  // Optional: omitted, the renderer falls back to its own default 5-level
  // cycle (see anvilnote-renderer's own marker-modules.ts). Set whenever the
  // export path has access to the user's settings-store choices, so the
  // exported PDF's list markers match what's shown in the live editor.
  orderedListLevels?: OrderedModuleId[];
  unorderedListLevels?: UnorderedSymbol[];
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
  numberedHeadings: boolean;
  marginTopCm: number | null;
  marginBottomCm: number | null;
  marginLeftCm: number | null;
  marginRightCm: number | null;
  content: JSONContent;
  sourceFormat: "tiptap-json";
  mathFormat: "latex";
  exportOptions: ExportOptions;
};
