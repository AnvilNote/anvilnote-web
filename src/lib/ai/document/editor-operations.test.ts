import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { applyAIContent, applyInlineAIContent, isEmptyEditorDocument } from "./editor-operations";

function editor(content: object) {
  return new Editor({ extensions: [StarterKit], content });
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
