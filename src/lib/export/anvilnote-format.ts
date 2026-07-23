import type { JSONContent } from "@tiptap/core";
import type { AnvilDocument, AnvilMetadataValue } from "@/types/document";
import { sanitizeFilename } from "@/lib/export-filename";

// The .anvilnote native format: a lossless, schema-identical JSON snapshot of
// a document. Unlike Markdown export (tiptap-to-markdown.ts), content is
// carried as raw Tiptap JSON with no conversion or normalization, so node
// types Markdown can't represent (statsChart, mermaid, question, …) survive
// export/import round-trips intact. JSON export uses this exact same schema
// and serializer — only the file extension/mimetype differs.

export const ANVILNOTE_FORMAT = "anvilnote";
export const ANVILNOTE_FORMAT_VERSION = 1;

export type AnvilNoteFile = {
  format: typeof ANVILNOTE_FORMAT;
  version: number;
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
  createdAt: string;
  updatedAt: string;
};

export type ParsedAnvilNoteDocument = {
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
};

export function serializeDocumentToAnvilNote(doc: AnvilDocument): AnvilNoteFile {
  return {
    format: ANVILNOTE_FORMAT,
    version: ANVILNOTE_FORMAT_VERSION,
    title: doc.title,
    templateId: doc.templateId,
    metadata: doc.metadata,
    templateSettings: doc.templateSettings,
    numberedHeadings: doc.numberedHeadings,
    marginTopCm: doc.marginTopCm,
    marginBottomCm: doc.marginBottomCm,
    marginLeftCm: doc.marginLeftCm,
    marginRightCm: doc.marginRightCm,
    content: doc.content,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function documentToAnvilNoteJson(doc: AnvilDocument): string {
  return JSON.stringify(serializeDocumentToAnvilNote(doc), null, 2);
}

export function parseAnvilNoteFile(raw: string, fallbackTitle: string): ParsedAnvilNoteDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid .anvilnote file: not valid JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { format?: unknown }).format !== ANVILNOTE_FORMAT
  ) {
    throw new Error('Invalid .anvilnote file: missing or wrong "format" field');
  }

  const file = parsed as Partial<AnvilNoteFile>;
  return {
    title: file.title || fallbackTitle,
    templateId: file.templateId ?? "",
    metadata: file.metadata ?? {},
    templateSettings: file.templateSettings ?? {},
    numberedHeadings: file.numberedHeadings ?? true,
    marginTopCm: file.marginTopCm ?? null,
    marginBottomCm: file.marginBottomCm ?? null,
    marginLeftCm: file.marginLeftCm ?? null,
    marginRightCm: file.marginRightCm ?? null,
    content: file.content ?? { type: "doc", content: [] },
  };
}

export function documentAnvilNoteFilename(doc: AnvilDocument): string {
  return `${sanitizeFilename(doc.title || "Untitled")}.anvilnote`;
}

export function documentJsonFilename(doc: AnvilDocument): string {
  return `${sanitizeFilename(doc.title || "Untitled")}.json`;
}
