import type { AnvilMetadataValue } from "./document";

export type ExportPageSize = "A4" | "Letter";
export type ExportFontPreset = "sans" | "serif" | "mono";

export type ExportOptions = {
  pageSize: ExportPageSize;
  fontPreset: ExportFontPreset;
  includeMetadata: boolean;
};

export type ExportPayload = {
  documentId: string;
  title: string;
  templateId: string;
  metadata: Record<string, AnvilMetadataValue>;
  blocks: unknown[];
  exportOptions: ExportOptions;
};
