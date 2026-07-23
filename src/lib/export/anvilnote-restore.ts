import JSZip from "jszip";

// Reverses anvilnote-backup.ts: reads .anvilnote/.json files out of a zip
// backup — mirrors restore.ts's readZipMarkdownFiles, but for the native
// lossless format instead of Markdown. Actual JSON -> document-field parsing
// lives in anvilnote-format.ts's parseAnvilNoteFile (shared with the
// non-zipped single-file import path).

export type ZipEntry = {
  /** Top-level folder name the file was under, or null if at the zip root. */
  folder: string | null;
  filename: string;
  raw: string;
};

function isAnvilNoteEntry(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".anvilnote") || lower.endsWith(".json");
}

/** Read every .anvilnote/.json file out of a zip backup, noting which top-level folder (if any) it was in. */
export async function readZipAnvilNoteFiles(file: File): Promise<ZipEntry[]> {
  const zip = await JSZip.loadAsync(file);
  const entries: ZipEntry[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !isAnvilNoteEntry(path)) continue;
    const parts = path.split("/").filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : null;
    const filename = parts[parts.length - 1];
    const raw = await entry.async("string");
    entries.push({ folder, filename, raw });
  }

  return entries;
}
