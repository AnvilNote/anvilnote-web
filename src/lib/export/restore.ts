import JSZip from "jszip";
import type { JSONContent } from "@tiptap/core";
import type { AnvilMetadataValue } from "@/types/document";
import { markdownToTiptapDoc } from "@/lib/export/markdown-to-tiptap";

// Reverses backup.ts: parses a .md file (as produced by our export, or any
// Markdown file with optional YAML-ish frontmatter) back into document
// fields, and unpacks a .zip backup into a flat list of parsed files.

export type ParsedDocument = {
  title: string;
  templateId: string | null;
  metadata: Record<string, AnvilMetadataValue>;
  content: JSONContent;
};

function parseFrontmatterValue(raw: string): AnvilMetadataValue {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "") return null;
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

/**
 * Split a Markdown file into its frontmatter (our writer's own dialect — flat
 * `key: value` lines plus one `metadata:` block of 2-space-indented entries)
 * and body. Files without a `---` frontmatter block are returned as pure body.
 */
function splitFrontmatter(raw: string): {
  fields: Record<string, string>;
  metadata: Record<string, AnvilMetadataValue>;
  body: string;
} {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { fields: {}, metadata: {}, body: raw };
  }

  const [, frontmatterBlock, body] = match;
  const fields: Record<string, string> = {};
  const metadata: Record<string, AnvilMetadataValue> = {};
  let inMetadata = false;

  for (const line of frontmatterBlock.split("\n")) {
    if (line === "metadata:") {
      inMetadata = true;
      continue;
    }
    if (inMetadata && /^ {2}\S/.test(line)) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(2, idx).trim();
      metadata[key] = parseFrontmatterValue(line.slice(idx + 1));
      continue;
    }
    inMetadata = false;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return { fields, metadata, body };
}

/** Drop a leading "# Title" line from the body — the title lives in
 * frontmatter/filename, so re-showing it as body content would duplicate it.
 * The frontmatter/body split leaves a blank line before it, so skip that
 * first. */
function stripLeadingTitleHeading(body: string, title: string): string {
  const withoutLeadingBlank = body.replace(/^\n+/, "");
  const lines = withoutLeadingBlank.split("\n");
  if (lines[0]?.trim() === `# ${title}`.trim()) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return body;
}

export function parseMarkdownFile(raw: string, fallbackTitle: string): ParsedDocument {
  const { fields, metadata, body } = splitFrontmatter(raw);
  const title = fields.title
    ? (parseFrontmatterValue(fields.title) as string)
    : fallbackTitle;
  const templateId = fields.template
    ? (parseFrontmatterValue(fields.template) as string)
    : null;

  return {
    title: title || fallbackTitle,
    templateId,
    metadata,
    content: markdownToTiptapDoc(stripLeadingTitleHeading(body, title)),
  };
}

export type ZipEntry = {
  /** Top-level folder name the file was under, or null if at the zip root. */
  folder: string | null;
  filename: string;
  raw: string;
};

/** Read every .md file out of a zip backup, noting which top-level folder (if any) it was in. */
export async function readZipMarkdownFiles(file: File): Promise<ZipEntry[]> {
  const zip = await JSZip.loadAsync(file);
  const entries: ZipEntry[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.toLowerCase().endsWith(".md")) continue;
    const parts = path.split("/").filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : null;
    const filename = parts[parts.length - 1];
    const raw = await entry.async("string");
    entries.push({ folder, filename, raw });
  }

  return entries;
}
