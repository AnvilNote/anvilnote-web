import { Editor, type AnyExtension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it, vi } from "vitest";
import { buildEditSnapshot } from "@anvilnote/ai-writer";
import { tiptapDocumentToAiSnapshotSource } from "./converters";
import {
  acceptVerifiedEditDraft,
  applyAIContent,
  applyInlineAIContent,
  isEmptyEditorDocument,
  type AcceptEditDependencies,
  type AiEditAcceptDraft,
} from "./editor-operations";

function editor(content: object, extensions: AnyExtension[] = [StarterKit]) {
  return new Editor({ extensions, content });
}

function documentHashOf(instance: Editor): string {
  return buildEditSnapshot(tiptapDocumentToAiSnapshotSource(instance.getJSON())).baseDocumentHash;
}

function noopDependencies(): AcceptEditDependencies {
  return {
    createVersion: vi.fn().mockResolvedValue(undefined),
    saveDocument: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AI editor operations", () => {
  it("applies every AI step as one undo event separated from prior typing", () => {
    const instance = editor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Before" }] }],
    });
    instance.commands.insertContentAt(7, { type: "text", text: " user" });
    const afterTyping = instance.getJSON();

    expect(
      applyAIContent(instance, { from: instance.state.doc.content.size, to: instance.state.doc.content.size }, [
        { type: "paragraph", content: [{ type: "text", text: "AI result" }] },
      ]),
    ).toBe(true);

    expect(instance.commands.undo()).toBe(true);
    expect(instance.getJSON()).toEqual(afterTyping);
    expect(instance.commands.undo()).toBe(true);
    expect(instance.getText()).toBe("Before");
    instance.destroy();
  });

  it("replaces a truly empty document without resetting its history plugin", () => {
    const instance = editor({ type: "doc", content: [{ type: "paragraph" }] });
    expect(isEmptyEditorDocument(instance)).toBe(true);

    expect(
      applyAIContent(instance, { from: 0, to: instance.state.doc.content.size }, [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Result" }] },
      ]),
    ).toBe(true);
    expect(instance.getJSON().content?.[0]).toEqual({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Result" }],
    });
    // StarterKit's trailing-node rule may append a single empty paragraph so
    // the cursor can move below a terminal heading; it carries no AI content.
    expect(instance.getJSON().content?.slice(1)).toEqual([{ type: "paragraph" }]);
    expect(instance.commands.undo()).toBe(true);
    expect(isEmptyEditorDocument(instance)).toBe(true);
    instance.destroy();
  });

  it("replaces only selected inline text and keeps the surrounding text block intact", () => {
    const instance = editor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Old wording stays" }] }],
    });
    const before = instance.getJSON();

    expect(
      applyInlineAIContent(instance, { from: 1, to: 4 }, [
        { type: "text", text: "New", marks: [{ type: "bold" }] },
      ]),
    ).toBe(true);
    expect(instance.getJSON()).toEqual({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "New" },
          { type: "text", text: " wording stays" },
        ],
      }],
    });

    expect(instance.commands.undo()).toBe(true);
    expect(instance.getJSON()).toEqual(before);
    instance.destroy();
  });

  it("rejects block nodes from an inline replacement", () => {
    const instance = editor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Old wording" }] }],
    });
    const before = instance.getJSON();

    expect(
      applyInlineAIContent(instance, { from: 1, to: 4 }, [
        { type: "paragraph", content: [{ type: "text", text: "Unsafe block" }] },
      ]),
    ).toBe(false);
    expect(instance.getJSON()).toEqual(before);
    instance.destroy();
  });
});

describe("acceptVerifiedEditDraft", () => {
  it("creates a version before saving, applies the candidate in one transaction, and leaves one Undo boundary", async () => {
    const instance = editor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Before" }] }],
    });
    const originalDocument = instance.getJSON();
    const baseDocumentHash = documentHashOf(instance);
    const expectedCandidate = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "After" }] }],
    };
    const draft: AiEditAcceptDraft = {
      baseDocumentHash,
      baseSelectionHash: null,
      selectionRange: null,
      candidate: [expectedCandidate],
    };
    const calls: string[] = [];
    const dependencies: AcceptEditDependencies = {
      createVersion: vi.fn().mockImplementation(async () => {
        calls.push("createVersion");
      }),
      saveDocument: vi.fn().mockImplementation(async () => {
        calls.push("saveDocument");
      }),
    };

    await acceptVerifiedEditDraft(instance, draft, dependencies);

    expect(calls).toEqual(["createVersion", "saveDocument"]);
    expect(instance.getJSON()).toEqual(expectedCandidate);

    expect(instance.commands.undo()).toBe(true);
    expect(instance.getJSON()).toEqual(originalDocument);
    instance.destroy();
  });

  it("rejects a stale document hash before creating a version, and leaves the editor untouched", async () => {
    const instance = editor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Live content" }] }],
    });
    const before = instance.getJSON();
    const draft: AiEditAcceptDraft = {
      baseDocumentHash: "0".repeat(64),
      baseSelectionHash: null,
      selectionRange: null,
      candidate: [{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "After" }] }] }],
    };
    const dependencies = noopDependencies();

    await expect(acceptVerifiedEditDraft(instance, draft, dependencies)).rejects.toThrow();

    expect(dependencies.createVersion).not.toHaveBeenCalled();
    expect(dependencies.saveDocument).not.toHaveBeenCalled();
    expect(instance.getJSON()).toEqual(before);
    instance.destroy();
  });

  it("rejects a stale selection hash before creating a version, and leaves the editor untouched", async () => {
    const instance = editor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Original selected text" }] },
      ],
    });
    const before = instance.getJSON();
    const baseDocumentHash = documentHashOf(instance);
    const draft: AiEditAcceptDraft = {
      baseDocumentHash,
      baseSelectionHash: "0".repeat(64),
      selectionRange: { from: 1, to: 9 },
      candidate: [{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "After" }] }] }],
    };
    const dependencies = noopDependencies();

    await expect(acceptVerifiedEditDraft(instance, draft, dependencies)).rejects.toThrow();

    expect(dependencies.createVersion).not.toHaveBeenCalled();
    expect(dependencies.saveDocument).not.toHaveBeenCalled();
    expect(instance.getJSON()).toEqual(before);
    instance.destroy();
  });

  it("never dispatches a transaction when the version checkpoint fails", async () => {
    const instance = editor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Before" }] }],
    });
    const before = instance.getJSON();
    const draft: AiEditAcceptDraft = {
      baseDocumentHash: documentHashOf(instance),
      baseSelectionHash: null,
      selectionRange: null,
      candidate: [{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "After" }] }] }],
    };
    const dependencies: AcceptEditDependencies = {
      createVersion: vi.fn().mockRejectedValue(new Error("offline")),
      saveDocument: vi.fn().mockResolvedValue(undefined),
    };

    await expect(acceptVerifiedEditDraft(instance, draft, dependencies)).rejects.toThrow("offline");

    expect(dependencies.saveDocument).not.toHaveBeenCalled();
    expect(instance.getJSON()).toEqual(before);
    instance.destroy();
  });

  it("restores the exact pre-accept JSON, invisibly to Undo history, when saving fails", async () => {
    const instance = editor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Before" }] }],
    });
    const originalDocument = instance.getJSON();
    const draft: AiEditAcceptDraft = {
      baseDocumentHash: documentHashOf(instance),
      baseSelectionHash: null,
      selectionRange: null,
      candidate: [{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "After" }] }] }],
    };
    const dependencies: AcceptEditDependencies = {
      createVersion: vi.fn().mockResolvedValue(undefined),
      saveDocument: vi.fn().mockRejectedValue(new Error("offline")),
    };

    await expect(acceptVerifiedEditDraft(instance, draft, dependencies)).rejects.toThrow("offline");

    // Rolled back to the exact pre-accept content...
    expect(instance.getJSON()).toEqual(originalDocument);
    // ...and the rollback itself did not add a new Undo entry: a single
    // subsequent undo() call is a no-op (there was nothing before this
    // document's own creation to undo back to), never a "double undo"
    // needed to reach a clean state, and it never resurrects the rejected
    // candidate content.
    expect(instance.commands.undo()).toBe(false);
    expect(instance.getJSON()).toEqual(originalDocument);
    instance.destroy();
  });

  it("keeps a protected image subtree byte-for-byte identical through the accept transaction", async () => {
    const instance = editor(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Before" }] },
          {
            type: "image",
            attrs: { src: "data:image/png;base64,AAAABBBBCCCC", alt: "Diagram", title: "A title" },
          },
        ],
      },
      [StarterKit, Image],
    );
    const originalImage = instance.getJSON().content?.[1];
    const baseDocumentHash = documentHashOf(instance);
    const draft: AiEditAcceptDraft = {
      baseDocumentHash,
      baseSelectionHash: null,
      selectionRange: null,
      candidate: [
        {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "After" }] },
            originalImage as { type: string },
          ],
        },
      ],
    };
    const dependencies = noopDependencies();

    await acceptVerifiedEditDraft(instance, draft, dependencies);

    expect(instance.getJSON().content?.[1]).toEqual(originalImage);
    instance.destroy();
  });
});
