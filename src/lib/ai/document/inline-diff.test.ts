import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import {
  clearInlineAIDiff,
  InlineAIDiffExtension,
  inlineAIDiffPluginKey,
  showInlineAISelection,
  showInlineAIDiff,
} from "./inline-diff";

function createEditor() {
  return new Editor({
    extensions: [StarterKit],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "old text" }] }] },
  });
}

describe("inline Smart Mode diff", () => {
  it("installs the decoration plugin with the editor instead of from the floating UI", () => {
    const editor = new Editor({
      extensions: [StarterKit, InlineAIDiffExtension],
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "old text" }] }] },
    });

    expect(inlineAIDiffPluginKey.getState(editor.state)).toBeDefined();
    editor.destroy();
  });

  it("keeps the selected text visibly marked while the inline composer has focus", () => {
    const editor = createEditor();
    const before = editor.getJSON();

    showInlineAISelection(editor, { from: 1, to: 4 });

    expect(editor.getJSON()).toEqual(before);
    const decorations = inlineAIDiffPluginKey.getState(editor.state)?.find() ?? [];
    expect(decorations).toHaveLength(1);
    expect(
      (decorations[0] as unknown as { type: { attrs: { class: string } } }).type.attrs.class,
    ).toBe("anvil-ai-inline-selection");
    expect(editor.view.dom.querySelector(".anvil-ai-inline-selection")?.textContent).toBe("old");

    editor.commands.blur();
    expect(editor.view.dom.querySelector(".anvil-ai-inline-selection")?.textContent).toBe("old");
    editor.destroy();
  });

  it("renders a temporary review without changing the document", () => {
    const editor = createEditor();
    const before = editor.getJSON();
    showInlineAIDiff(editor, { from: 1, to: 4, replacementText: "new" });

    expect(editor.getJSON()).toEqual(before);
    expect(inlineAIDiffPluginKey.getState(editor.state)?.find()).toHaveLength(2);

    clearInlineAIDiff(editor);
    expect(inlineAIDiffPluginKey.getState(editor.state)?.find()).toHaveLength(0);
    editor.destroy();
  });

  it("clears an unaccepted review on a document change", () => {
    const editor = createEditor();
    showInlineAIDiff(editor, { from: 1, to: 4, replacementText: "new" });
    editor.commands.insertContentAt(editor.state.doc.content.size, { type: "paragraph", content: [{ type: "text", text: "later" }] });

    expect(inlineAIDiffPluginKey.getState(editor.state)?.find()).toHaveLength(0);
    editor.destroy();
  });
});
