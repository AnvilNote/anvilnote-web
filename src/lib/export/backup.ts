import JSZip from "jszip";
import type { AnvilDocument, AnvilMetadataValue } from "@/types/document";
import type { AnvilProject } from "@/types/project";
import { tiptapDocToMarkdown } from "@/lib/export/tiptap-to-markdown";
import { sanitizeFilename, exportTimestamp } from "@/lib/export-filename";
import { deliverFile, type DeliverResult } from "@/lib/export-target";

// Markdown/zip backup export. Each document becomes a standalone .md file
// (YAML frontmatter + an H1 title + the converted body); exporting more than
// one document at once bundles them into a single zip named
// "AnvilNote-backup-<yyyymmddHHMMSS>.zip".

function yamlValue(value: AnvilMetadataValue | string): string {
  if (typeof value === "boolean") return String(value);
  if (value === null) return "null";
  // JSON string escaping is a valid YAML double-quoted scalar for our purposes
  // (titles/metadata are plain user text, never containing exotic control
  // characters JSON and YAML disagree on).
  return JSON.stringify(value);
}

function frontmatter(doc: AnvilDocument): string {
  const lines = [
    "---",
    `title: ${yamlValue(doc.title || "Untitled")}`,
    `template: ${yamlValue(doc.templateId)}`,
    `createdAt: ${yamlValue(doc.createdAt)}`,
    `updatedAt: ${yamlValue(doc.updatedAt)}`,
  ];
  const metaEntries = Object.entries(doc.metadata).filter(
    ([, v]) => v !== null && v !== "",
  );
  if (metaEntries.length > 0) {
    lines.push("metadata:");
    for (const [key, value] of metaEntries) {
      lines.push(`  ${key}: ${yamlValue(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

export function documentToMarkdown(doc: AnvilDocument): string {
  const title = doc.title || "Untitled";
  const body = tiptapDocToMarkdown(doc.content);
  return `${frontmatter(doc)}\n\n# ${title}\n\n${body}\n`;
}

export function documentMarkdownFilename(doc: AnvilDocument): string {
  return `${sanitizeFilename(doc.title || "Untitled")}.md`;
}

export function backupZipFilename(date = new Date()): string {
  return `AnvilNote-backup-${exportTimestamp(date)}.zip`;
}

/** Export a single document as a standalone .md file. */
export async function exportDocumentMarkdown(
  doc: AnvilDocument,
  subfolder?: string,
): Promise<DeliverResult> {
  const blob = new Blob([documentToMarkdown(doc)], {
    type: "text/markdown;charset=utf-8",
  });
  return deliverFile(blob, documentMarkdownFilename(doc), subfolder);
}

// Adds one .md file per document, de-duplicating filenames within the same
// zip folder (e.g. two documents both titled "Untitled").
function addDocumentsToZip(zip: JSZip, documents: AnvilDocument[]) {
  const used = new Set<string>();
  for (const doc of documents) {
    const base = sanitizeFilename(doc.title || "Untitled");
    let name = `${base}.md`;
    let n = 2;
    while (used.has(name)) {
      name = `${base} (${n}).md`;
      n += 1;
    }
    used.add(name);
    zip.file(name, documentToMarkdown(doc));
  }
}

function uniqueFolderName(used: Set<string>, base: string): string {
  let name = base;
  let n = 2;
  while (used.has(name)) {
    name = `${base} (${n})`;
    n += 1;
  }
  used.add(name);
  return name;
}

/** Export every document in one project as a single zip of .md files. */
export async function exportProjectBackup(
  documents: AnvilDocument[],
): Promise<DeliverResult> {
  const zip = new JSZip();
  addDocumentsToZip(zip, documents);
  const blob = await zip.generateAsync({ type: "blob" });
  return deliverFile(blob, backupZipFilename());
}

/**
 * Export every document across every project as one zip: one folder per
 * project, plus an `unfiledFolderName` folder for documents with no project.
 */
export async function exportAllBackup(
  documents: AnvilDocument[],
  projects: AnvilProject[],
  unfiledFolderName: string,
): Promise<DeliverResult> {
  const zip = new JSZip();
  const byProject = new Map<string, AnvilDocument[]>();
  const unfiled: AnvilDocument[] = [];
  for (const doc of documents) {
    if (doc.projectId) {
      const list = byProject.get(doc.projectId) ?? [];
      list.push(doc);
      byProject.set(doc.projectId, list);
    } else {
      unfiled.push(doc);
    }
  }

  const usedFolderNames = new Set<string>();
  for (const project of projects) {
    const docs = byProject.get(project.id);
    if (!docs || docs.length === 0) continue;
    const folderName = uniqueFolderName(
      usedFolderNames,
      sanitizeFilename(project.name),
    );
    const folder = zip.folder(folderName);
    if (folder) addDocumentsToZip(folder, docs);
  }

  if (unfiled.length > 0) {
    const folder = zip.folder(
      uniqueFolderName(usedFolderNames, sanitizeFilename(unfiledFolderName)),
    );
    if (folder) addDocumentsToZip(folder, unfiled);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return deliverFile(blob, backupZipFilename());
}
