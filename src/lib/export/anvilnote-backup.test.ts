import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { blobToText, blobToArrayBuffer } from "@/lib/export/__test-helpers__/blob";
import type { AnvilDocument } from "@/types/document";
import type { AnvilProject } from "@/types/project";
import {
  documentAnvilNoteFilename,
  documentToAnvilNoteJson,
} from "@/lib/export/anvilnote-format";

// Mocked so exportDocumentAnvilNote/exportProjectAnvilNoteBackup/
// exportAllAnvilNoteBackup can be tested in Node without a File System Access
// API or a real download — intercept the blob deliverFile is given and hand
// back a fixed result instead.
vi.mock("@/lib/export-target", () => ({
  deliverFile: vi.fn(async (blob: Blob, fileName: string) => ({
    kind: "download" as const,
    fileName,
    _blob: blob,
  })),
}));

import {
  exportAllAnvilNoteBackup,
  exportDocumentAnvilNote,
  exportProjectAnvilNoteBackup,
} from "@/lib/export/anvilnote-backup";

function makeDoc(overrides: Partial<AnvilDocument> = {}): AnvilDocument {
  return {
    id: "doc-1",
    title: "筆記 A",
    content: { type: "doc", content: [{ type: "mermaid", attrs: { source: "graph TD;" } }] },
    templateId: "plain-note",
    metadata: {},
    templateSettings: {},
    numberedHeadings: true,
    marginTopCm: null,
    marginBottomCm: null,
    marginLeftCm: null,
    marginRightCm: null,
    projectId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("exportDocumentAnvilNote", () => {
  it("delivers a single .anvilnote file with the document's serialized content", async () => {
    const doc = makeDoc();
    const result = (await exportDocumentAnvilNote(doc)) as unknown as { fileName: string; _blob: Blob };

    expect(result.fileName).toBe(documentAnvilNoteFilename(doc));
    const text = await blobToText(result._blob);
    expect(text).toBe(documentToAnvilNoteJson(doc));
  });
});

describe("exportProjectAnvilNoteBackup", () => {
  it("zips every document as a .anvilnote file", async () => {
    const docs = [makeDoc({ id: "a", title: "First" }), makeDoc({ id: "b", title: "Second" })];
    const result = (await exportProjectAnvilNoteBackup(docs, "My Project")) as unknown as {
      _blob: Blob;
    };

    const zip = await JSZip.loadAsync(await blobToArrayBuffer(result._blob));
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(["First.anvilnote", "Second.anvilnote"]);
    const firstText = await zip.files["First.anvilnote"].async("string");
    expect(firstText).toBe(documentToAnvilNoteJson(docs[0]));
  });

  it("de-duplicates same-titled documents within one zip", async () => {
    const docs = [makeDoc({ id: "a", title: "Same" }), makeDoc({ id: "b", title: "Same" })];
    const result = (await exportProjectAnvilNoteBackup(docs, "P")) as unknown as { _blob: Blob };
    const zip = await JSZip.loadAsync(await blobToArrayBuffer(result._blob));
    expect(Object.keys(zip.files).sort()).toEqual(["Same (2).anvilnote", "Same.anvilnote"]);
  });
});

describe("exportAllAnvilNoteBackup", () => {
  it("groups documents into one folder per project, plus an unfiled folder", async () => {
    const projects: AnvilProject[] = [
      { id: "p1", name: "Project One", icon: null, createdAt: "", updatedAt: "" },
    ];
    const docs = [
      makeDoc({ id: "a", title: "In Project", projectId: "p1" }),
      makeDoc({ id: "b", title: "No Project", projectId: null }),
    ];
    const result = (await exportAllAnvilNoteBackup(docs, projects, "Unfiled")) as unknown as {
      _blob: Blob;
    };

    const zip = await JSZip.loadAsync(await blobToArrayBuffer(result._blob));
    const fileNames = Object.entries(zip.files)
      .filter(([, entry]) => !entry.dir)
      .map(([name]) => name)
      .sort();
    expect(fileNames).toEqual(["Project One/In Project.anvilnote", "Unfiled/No Project.anvilnote"]);
  });
});
