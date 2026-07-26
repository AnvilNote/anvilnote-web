import { Editor, type JSONContent } from "@tiptap/core";
import { buildEditSnapshot } from "@anvilnote/ai-writer";
import { describe, expect, it, vi } from "vitest";
import { buildExtensions } from "@/lib/tiptap/extensions";
import { acceptVerifiedEditDraft } from "./document/editor-operations";
import { tiptapDocumentToAiSnapshotSource } from "./document/converters";
import { tiptapSelectionToEditSnapshot } from "./document/selection-snapshot";

interface MutableJSONNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<Record<string, unknown>>;
  content?: MutableJSONNode[];
}

const mixedDocument: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "短",
          marks: [{ type: "textStyle", attrs: { color: "#336699" } }],
        },
        ...Array.from({ length: 6 }, () => ({ type: "inlineBlank" })),
        {
          type: "footnoteReference",
          attrs: {
            "data-id": "fn-1",
            referenceNumber: "1",
            class: "footnote-ref",
            href: "#fn:1",
          },
        },
        { type: "text", text: "與" },
        {
          type: "footnoteReference",
          attrs: {
            "data-id": "fn-2",
            referenceNumber: "2",
            class: "footnote-ref",
            href: "#fn:2",
          },
        },
      ],
    },
    {
      type: "mermaid",
      attrs: { source: "graph TD; A-->B", theme: "default" },
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "尾段" }],
    },
    {
      type: "footnotes",
      content: [
        {
          type: "footnote",
          attrs: { id: "fn:1", "data-id": "fn-1" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "註腳一" }] }],
        },
        {
          type: "footnote",
          attrs: { id: "fn:2", "data-id": "fn-2" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "註腳二" }] }],
        },
      ],
    },
  ],
};

function createMixedEditor(): Editor {
  return new Editor({
    extensions: buildExtensions({
      placeholder: "",
      figureLabel: "",
      tableLabel: "",
      figureCaptionPlaceholder: "",
      tableCaptionPlaceholder: "",
      tableDeleteLabel: "",
      tableAddRowLabel: "",
      tableAddColumnLabel: "",
      tableResizeRowLabel: "",
      tableResizeColumnLabel: "",
      questionBodyPlaceholder: "",
      choicePlaceholder: () => "",
      tableHeaderPlaceholder: "",
      tableCellPlaceholder: "",
      onMathClick: () => {},
    }),
    content: mixedDocument,
  });
}

function rangeForText(editor: Editor, text: string): { from: number; to: number } {
  let range: { from: number; to: number } | undefined;
  editor.state.doc.descendants((node, pos) => {
    if (!range && node.isText && node.text === text) {
      range = { from: pos, to: pos + text.length };
    }
  });
  if (!range) throw new Error(`Text not found: ${text}`);
  return range;
}

function documentHash(editor: Editor): string {
  return buildEditSnapshot(
    tiptapDocumentToAiSnapshotSource(editor.getJSON()),
  ).baseDocumentHash;
}

function candidateWithBothChanges(editor: Editor): JSONContent {
  const candidate = structuredClone(editor.getJSON()) as MutableJSONNode;
  const firstText = candidate.content?.[0]?.content?.[0];
  if (!firstText) throw new Error("Expected the leading colored text.");
  firstText.text = "這是一段變長的文字";
  candidate.content?.splice(-1, 0, {
    type: "paragraph",
    content: [{ type: "text", text: "新增的結構段落" }],
  });
  return candidate as JSONContent;
}

describe("full-structure AI flow", () => {
  it("keeps preview detached, accepts an unchanged two-character selection, and undoes both edits", async () => {
    const editor = createMixedEditor();
    const original = editor.getJSON();
    const selectionRange = rangeForText(editor, "尾段");
    const { baseSelectionHash } =
      tiptapSelectionToEditSnapshot(editor, selectionRange);
    const candidate = candidateWithBothChanges(editor);
    const dependencies = {
      createVersion: vi.fn().mockResolvedValue(undefined),
      saveDocument: vi.fn().mockResolvedValue(undefined),
    };

    expect(editor.getJSON()).toEqual(original);
    await acceptVerifiedEditDraft(editor, {
      baseDocumentHash: documentHash(editor),
      baseSelectionHash,
      selectionRange,
      candidate: [candidate as { type: "doc"; content: JSONContent[] }],
    }, dependencies);

    const accepted = editor.getJSON() as MutableJSONNode;
    expect(accepted.content?.[0]?.content?.[0]?.text).toBe(
      "這是一段變長的文字",
    );
    expect(accepted.content?.some(
      (node) => node.content?.[0]?.text === "新增的結構段落",
    )).toBe(true);
    expect(dependencies.createVersion).toHaveBeenCalledOnce();
    expect(dependencies.saveDocument).toHaveBeenCalledOnce();
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getJSON()).toEqual(original);
    editor.destroy();
  });

  it("rejects a genuine selection mutation before createVersion or saveDocument", async () => {
    const editor = createMixedEditor();
    const selectionRange = rangeForText(editor, "尾段");
    const { baseSelectionHash } =
      tiptapSelectionToEditSnapshot(editor, selectionRange);
    editor.commands.insertContentAt(selectionRange, "異動");
    const mutated = editor.getJSON();
    const dependencies = {
      createVersion: vi.fn().mockResolvedValue(undefined),
      saveDocument: vi.fn().mockResolvedValue(undefined),
    };

    await expect(acceptVerifiedEditDraft(editor, {
      baseDocumentHash: documentHash(editor),
      baseSelectionHash,
      selectionRange,
      candidate: [mutated as { type: "doc"; content: JSONContent[] }],
    }, dependencies)).rejects.toThrow("selection_conflict");

    expect(dependencies.createVersion).not.toHaveBeenCalled();
    expect(dependencies.saveDocument).not.toHaveBeenCalled();
    expect(editor.getJSON()).toEqual(mutated);
    editor.destroy();
  });
});
