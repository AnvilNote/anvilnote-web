import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { AnvilDocument } from "@/types/document";
import {
  documentAnvilNoteFilename,
  documentToAnvilNoteJson,
  parseAnvilNoteFile,
} from "@/lib/export/anvilnote-format";
import { readZipAnvilNoteFiles } from "@/lib/export/anvilnote-restore";

function makeDoc(overrides: Partial<AnvilDocument> = {}): AnvilDocument {
  return {
    id: "doc-1",
    title: "含圖表筆記",
    content: {
      type: "doc",
      content: [
        { type: "statsChart", attrs: { chartType: "pie", categoricalData: [] } },
        { type: "question", attrs: { prompt: "?", answer: "!" } },
      ],
    },
    templateId: "plain-note",
    metadata: { author: "Anthony" },
    templateSettings: { toc: true },
    numberedHeadings: false,
    marginTopCm: 1,
    marginBottomCm: 1,
    marginLeftCm: null,
    marginRightCm: null,
    projectId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function zipToFile(zip: JSZip, name = "backup.zip"): Promise<File> {
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], name);
}

describe("readZipAnvilNoteFiles", () => {
  it("reads .anvilnote and .json entries, ignoring .md entries", async () => {
    const zip = new JSZip();
    zip.file("root.anvilnote", "{}");
    zip.file("Folder/nested.json", "{}");
    zip.file("ignored.md", "# not us");
    const file = await zipToFile(zip);

    const entries = await readZipAnvilNoteFiles(file);
    const byName = entries.map((e) => ({ folder: e.folder, filename: e.filename }));
    expect(byName.sort((a, b) => a.filename.localeCompare(b.filename))).toEqual([
      { folder: "Folder", filename: "nested.json" },
      { folder: null, filename: "root.anvilnote" },
    ]);
  });

  it("round-trips a document losslessly through export zip -> read -> parse", async () => {
    const doc = makeDoc();
    const zip = new JSZip();
    zip.file(documentAnvilNoteFilename(doc), documentToAnvilNoteJson(doc));
    const file = await zipToFile(zip);

    const [entry] = await readZipAnvilNoteFiles(file);
    const parsed = parseAnvilNoteFile(entry.raw, entry.filename.replace(/\.anvilnote$/, ""));

    expect(parsed.title).toBe(doc.title);
    expect(parsed.templateId).toBe(doc.templateId);
    expect(parsed.metadata).toEqual(doc.metadata);
    expect(parsed.templateSettings).toEqual(doc.templateSettings);
    expect(parsed.numberedHeadings).toBe(doc.numberedHeadings);
    expect(parsed.marginTopCm).toBe(doc.marginTopCm);
    expect(parsed.marginBottomCm).toBe(doc.marginBottomCm);
    expect(parsed.content).toEqual(doc.content);
  });
});
