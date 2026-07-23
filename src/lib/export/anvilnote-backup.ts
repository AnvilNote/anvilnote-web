import JSZip from "jszip";
import type { AnvilDocument } from "@/types/document";
import type { AnvilProject } from "@/types/project";
import { documentAnvilNoteFilename, documentToAnvilNoteJson } from "@/lib/export/anvilnote-format";
import { sanitizeFilename } from "@/lib/export-filename";
import { backupZipFilename, projectBackupZipFilename } from "@/lib/export/backup";
import { deliverFile, type DeliverResult } from "@/lib/export-target";

// .anvilnote/zip native backup export — mirrors backup.ts's Markdown/zip
// export structure exactly (same zip filenames, same folder-per-project
// layout), but each document becomes a standalone .anvilnote file (lossless
// JSON snapshot, via anvilnote-format.ts) instead of a converted .md file.

function addDocumentsToZip(zip: JSZip, documents: AnvilDocument[]) {
  const used = new Set<string>();
  for (const doc of documents) {
    const base = sanitizeFilename(doc.title || "Untitled");
    let name = `${base}.anvilnote`;
    let n = 2;
    while (used.has(name)) {
      name = `${base} (${n}).anvilnote`;
      n += 1;
    }
    used.add(name);
    zip.file(name, documentToAnvilNoteJson(doc));
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

/** Export a single document as a standalone .anvilnote file. */
export async function exportDocumentAnvilNote(
  doc: AnvilDocument,
  subfolder?: string,
): Promise<DeliverResult> {
  const blob = new Blob([documentToAnvilNoteJson(doc)], {
    type: "application/json;charset=utf-8",
  });
  return deliverFile(blob, documentAnvilNoteFilename(doc), subfolder);
}

/** Export every document in one project as a single zip of .anvilnote files. */
export async function exportProjectAnvilNoteBackup(
  documents: AnvilDocument[],
  projectName: string,
): Promise<DeliverResult> {
  const zip = new JSZip();
  addDocumentsToZip(zip, documents);
  const blob = await zip.generateAsync({ type: "blob" });
  return deliverFile(blob, projectBackupZipFilename(projectName));
}

/**
 * Export every document across every project as one zip: one folder per
 * project, plus an `unfiledFolderName` folder for documents with no project.
 */
export async function exportAllAnvilNoteBackup(
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
    const folderName = uniqueFolderName(usedFolderNames, sanitizeFilename(project.name));
    const folder = zip.folder(folderName);
    if (folder) addDocumentsToZip(folder, docs);
  }

  if (unfiled.length > 0) {
    const folder = zip.folder(uniqueFolderName(usedFolderNames, sanitizeFilename(unfiledFolderName)));
    if (folder) addDocumentsToZip(folder, unfiled);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return deliverFile(blob, backupZipFilename());
}
