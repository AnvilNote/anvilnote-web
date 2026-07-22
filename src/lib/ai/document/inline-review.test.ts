import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import {
  inlineReviewContent,
  inlineReviewText,
  isInlineReviewRangeActive,
  isPlainTextSelection,
  resolvePlainTextSelectionRange,
} from "./inline-review";

describe("inline Smart Mode review boundaries", () => {
  it("keeps a one-block text proposal, including supported marks", () => {
    const content = inlineReviewContent([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Better", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          { type: "text", text: "wording" },
        ],
      },
    ]);

    expect(content).toEqual([
      { type: "text", text: "Better", marks: [{ type: "bold" }] },
      { type: "hardBreak" },
      { type: "text", text: "wording" },
    ]);
    expect(inlineReviewText(content!)).toBe("Better\nwording");
  });

  it("rejects a structural proposal from an inline review", () => {
    expect(inlineReviewContent([
      { type: "paragraph", content: [{ type: "text", text: "First" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second" }] },
    ])).toBeNull();
    expect(inlineReviewContent([
      { type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "x" } }] },
    ])).toBeNull();
  });

  it("allows one ordinary marked text block but rejects a multi-block selection", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "First paragraph" }] },
          { type: "paragraph", content: [{ type: "text", text: "Second paragraph" }] },
        ],
      },
    });

    expect(isPlainTextSelection(editor, 1, 6)).toBe(true);
    expect(isPlainTextSelection(editor, 1, editor.state.doc.content.size - 1)).toBe(false);
    editor.destroy();
  });

  it("normalizes a whole paragraph selected through its structural boundaries", () => {
    const text = "判斷是否使用列表推導時，可先問兩個問題：這段程式是否主要目的是建立新串列？讀者是否能快速理解資料來源、篩選條件與轉換結果？若答案都是肯定的，列表推導通常是合適選擇。";
    const editor = new Editor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "可讀性與使用" }] },
          { type: "paragraph", content: [{ type: "text", text }] },
          { type: "paragraph", content: [{ type: "text", text: "下一段" }] },
        ],
      },
    });

    // The visible paragraph text is 9...91. A browser drag can report the
    // adjacent structural tokens 8...92 even though no neighbouring text is
    // selected.
    expect(resolvePlainTextSelectionRange(editor, 8, 92)).toEqual({ from: 9, to: 91 });
    expect(resolvePlainTextSelectionRange(editor, 9, 96)).toBeNull();
    editor.destroy();
  });

  it("clamps a small drag overshoot into a neighbouring heading, but rejects a whole extra block", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Python dict" }] },
          { type: "paragraph", content: [{ type: "text", text: "dict is a mapping type." }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Creating a dict" }] },
        ],
      },
    });

    // heading: 1..12 (node 0..13); paragraph: content 14..37 (node 13..38);
    // heading2: content 39..55. A drag meant for the paragraph that starts
    // one character early lands inside the previous heading's last word.
    expect(resolvePlainTextSelectionRange(editor, 11, 37)).toEqual({ from: 14, to: 37 });
    // ...and one that overshoots past the end lands inside the next heading.
    expect(resolvePlainTextSelectionRange(editor, 14, 41)).toEqual({ from: 14, to: 37 });
    // Grabbing the entire neighbouring heading (not just an overshoot letter)
    // is a genuine multi-block selection and must still be rejected.
    expect(resolvePlainTextSelectionRange(editor, 1, 38)).toBeNull();
    editor.destroy();
  });

  it("keeps an inline review actionable only while its original range remains selected", () => {
    expect(
      isInlineReviewRangeActive(
        { from: 3, to: 8 },
        { from: 3, to: 8 },
      ),
    ).toBe(true);
    expect(
      isInlineReviewRangeActive(
        { from: 3, to: 8 },
        { from: 3, to: 3 },
      ),
    ).toBe(false);
    expect(
      isInlineReviewRangeActive(
        { from: 3, to: 8 },
        { from: 4, to: 9 },
      ),
    ).toBe(false);
  });
});
