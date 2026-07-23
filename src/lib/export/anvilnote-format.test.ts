import { describe, expect, it } from "vitest";
import type { AnvilDocument } from "@/types/document";
import {
  ANVILNOTE_FORMAT_VERSION,
  documentAnvilNoteFilename,
  documentJsonFilename,
  documentToAnvilNoteJson,
  isAnvilNoteFilename,
  parseAnvilNoteFile,
  serializeDocumentToAnvilNote,
} from "@/lib/export/anvilnote-format";

// A document whose content includes node types Markdown export cannot
// round-trip (statsChart, mermaid, question) — this is exactly what
// .anvilnote/JSON export exists to preserve losslessly.
function makeDoc(overrides: Partial<AnvilDocument> = {}): AnvilDocument {
  return {
    id: "doc-1",
    title: "我的筆記",
    content: {
      type: "doc",
      content: [
        {
          type: "statsChart",
          attrs: { chartType: "bar", categoricalData: [{ label: "A", value: 1 }] },
        },
        { type: "mermaid", attrs: { source: "graph TD; A-->B;" } },
        { type: "question", attrs: { prompt: "2+2=?", answer: "4" } },
      ],
    },
    templateId: "plain-note",
    metadata: { author: "Anthony" },
    templateSettings: { toc: true },
    numberedHeadings: true,
    marginTopCm: 2.5,
    marginBottomCm: null,
    marginLeftCm: null,
    marginRightCm: null,
    projectId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("serializeDocumentToAnvilNote", () => {
  it("carries every exportable field over without altering content", () => {
    const doc = makeDoc();
    const file = serializeDocumentToAnvilNote(doc);

    expect(file.format).toBe("anvilnote");
    expect(file.version).toBe(ANVILNOTE_FORMAT_VERSION);
    expect(file.title).toBe(doc.title);
    expect(file.templateId).toBe(doc.templateId);
    expect(file.metadata).toEqual(doc.metadata);
    expect(file.templateSettings).toEqual(doc.templateSettings);
    expect(file.numberedHeadings).toBe(doc.numberedHeadings);
    expect(file.marginTopCm).toBe(doc.marginTopCm);
    expect(file.marginBottomCm).toBe(doc.marginBottomCm);
    expect(file.marginLeftCm).toBe(doc.marginLeftCm);
    expect(file.marginRightCm).toBe(doc.marginRightCm);
    // Deliberately NOT normalized/stripped, unlike buildExportPayload.
    expect(file.content).toEqual(doc.content);
  });
});

describe("documentToAnvilNoteJson", () => {
  it("serializes to a JSON string carrying the format marker", () => {
    const json = documentToAnvilNoteJson(makeDoc());
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe("anvilnote");
    expect(parsed.version).toBe(ANVILNOTE_FORMAT_VERSION);
  });
});

describe("parseAnvilNoteFile", () => {
  it("round-trips a document losslessly, including chart/mermaid/question nodes", () => {
    const doc = makeDoc();
    const json = documentToAnvilNoteJson(doc);
    const parsed = parseAnvilNoteFile(json, "fallback");

    expect(parsed.title).toBe(doc.title);
    expect(parsed.templateId).toBe(doc.templateId);
    expect(parsed.metadata).toEqual(doc.metadata);
    expect(parsed.templateSettings).toEqual(doc.templateSettings);
    expect(parsed.numberedHeadings).toBe(doc.numberedHeadings);
    expect(parsed.marginTopCm).toBe(doc.marginTopCm);
    expect(parsed.marginBottomCm).toBe(doc.marginBottomCm);
    expect(parsed.marginLeftCm).toBe(doc.marginLeftCm);
    expect(parsed.marginRightCm).toBe(doc.marginRightCm);
    expect(parsed.content).toEqual(doc.content);
  });

  it("falls back to the given title when the file has none", () => {
    const doc = makeDoc({ title: "" });
    const json = documentToAnvilNoteJson(doc);
    const parsed = parseAnvilNoteFile(json, "fallback title");
    expect(parsed.title).toBe("fallback title");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAnvilNoteFile("not json", "fallback")).toThrow();
  });

  it("throws when the format marker is missing or wrong", () => {
    expect(() => parseAnvilNoteFile(JSON.stringify({ title: "x" }), "fallback")).toThrow();
    expect(() =>
      parseAnvilNoteFile(JSON.stringify({ format: "something-else" }), "fallback"),
    ).toThrow();
  });
});

describe("filename helpers", () => {
  it("builds a sanitized .anvilnote filename", () => {
    expect(documentAnvilNoteFilename(makeDoc({ title: "a/b:c" }))).toBe("a b c.anvilnote");
  });

  it("builds a sanitized .json filename", () => {
    expect(documentJsonFilename(makeDoc({ title: "a/b:c" }))).toBe("a b c.json");
  });

  it("falls back to Untitled for an empty title", () => {
    expect(documentAnvilNoteFilename(makeDoc({ title: "" }))).toBe("Untitled.anvilnote");
  });
});

describe("isAnvilNoteFilename", () => {
  it("matches .anvilnote and .json, case-insensitively", () => {
    expect(isAnvilNoteFilename("Note.anvilnote")).toBe(true);
    expect(isAnvilNoteFilename("note.JSON")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isAnvilNoteFilename("note.md")).toBe(false);
    expect(isAnvilNoteFilename("note.zip")).toBe(false);
  });
});
