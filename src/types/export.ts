import type { JSONContent } from "@tiptap/core";
import type { AnvilMetadataValue } from "./document";
import type { OrderedModuleId, UnorderedSymbol } from "@/lib/list-markers/marker-modules";
import type { WatermarkSettings } from "@/lib/stores/settings-store";

export type ExportPageSize = "A4" | "B4" | "B5" | "Letter";
export type ExportFontPreset = "sans" | "serif" | "mono";
export type ExportFormat = "pdf" | "markdown" | "docx" | "json" | "anvilnote";

export type ExportOptions = {
  // Optional: omitted, buildExportPayload backfills from the document's own
  // pageSize override, else the global Settings > Export default -- same
  // reasoning as orderedListLevels/watermark below, so call sites don't need
  // to remember to read the document's override themselves.
  pageSize?: ExportPageSize;
  fontPreset: ExportFontPreset;
  includeMetadata: boolean;
  // Optional: omitted, the renderer falls back to its own default 5-level
  // cycle (see anvilnote-renderer's own marker-modules.ts). Set whenever the
  // export path has access to the user's settings-store choices, so the
  // exported PDF's list markers match what's shown in the live editor.
  orderedListLevels?: OrderedModuleId[];
  unorderedListLevels?: UnorderedSymbol[];
  // Same optional-passthrough shape as the two list-marker fields above:
  // omitted (or watermark.enabled === false) means the renderer skips the
  // page background entirely, same as before this existed.
  watermark?: WatermarkSettings;
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
