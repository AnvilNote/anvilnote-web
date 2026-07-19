import { describe, expect, it } from "vitest";
import {
  anvilNoteDocumentToTiptap,
  anvilNoteFragmentToTiptap,
  tiptapDocumentToAnvilNote,
  tiptapSelectionToAnvilNote,
  UnsupportedAIContentError,
} from "./converters";
import { ProtectedSelectionRegistry } from "./protected-selection";
import type { JSONContent } from "@tiptap/core";

const richDocument: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2, id: "intro" },
      content: [
        {
          type: "text",
          text: "Heading",
          marks: [
            { type: "bold" },
            { type: "italic" },
            { type: "underline" },
            { type: "strike" },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Visit " },
        {
          type: "text",
          text: "AnvilNote",
          marks: [
            {
              type: "link",
              attrs: { href: "https://anvilnote.example", title: "Site", target: "_blank" },
            },
          ],
        },
        { type: "hardBreak" },
        { type: "inlineMath", attrs: { latex: "x^2" } },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
        },
      ],
    },
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
    },
    {
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [{ type: "text", text: "const x = 1" }],
    },
    {
      type: "blockMath",
      attrs: { latex: "E=mc^2", id: "eq-1", equationNumber: "1", refName: "energy" },
    },
    {
      type: "table",
      attrs: { id: "table-1", caption: "Values", variant: "three-line", align: "center" },
      content: [
        {
          type: "tableRow",
          attrs: { rowHeight: 42 },
          content: [
            {
              type: "tableHeader",
              attrs: { colspan: 1, rowspan: 1, colwidth: [160] },
              content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
            },
            {
              type: "tableCell",
              attrs: { colspan: 2, rowspan: 1, colwidth: [80, 80] },
              content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
            },
          ],
        },
      ],
    },
    { type: "horizontalRule", attrs: { thicknessPt: 1.5, lineStyle: "dashed" } },
  ],
};

describe("Tiptap and AnvilNote AI AST converters", () => {
  it("round-trips supported blocks, inline nodes, marks, math, and table geometry", () => {
    const ai = tiptapDocumentToAnvilNote(richDocument);
    expect(anvilNoteDocumentToTiptap(ai)).toEqual(richDocument);
  });

  it("wraps a partial inline selection in a paragraph fragment", () => {
    expect(
      tiptapSelectionToAnvilNote([
        { type: "text", text: "selected", marks: [{ type: "bold" }] },
      ]),
    ).toEqual({
      schemaVersion: "anvilnote.fragment.v1",
      type: "fragment",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "selected", marks: [{ type: "bold" }] }],
        },
      ],
    });
  });

  it("round-trips canonical callouts without degrading them to blockquotes", () => {
    const callout: JSONContent = {
      type: "callout",
      attrs: { kind: "tip", title: "關鍵提醒", titleTouched: true },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "令 " },
            { type: "inlineMath", attrs: { latex: "0 < |x-a| < delta" } },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "檢查範圍" }],
                },
              ],
            },
          ],
        },
        { type: "blockMath", attrs: { latex: "L=M" } },
      ],
    };
    const ai = tiptapDocumentToAnvilNote({ type: "doc", content: [callout] });
    expect(ai.content[0]?.type).toBe("callout");
    expect(anvilNoteDocumentToTiptap(ai)).toEqual({
      type: "doc",
      content: [callout],
    });
  });

  it("maps a nullable AI callout title to the existing default-title presentation", () => {
    expect(
      anvilNoteDocumentToTiptap({
        schemaVersion: "anvilnote.document.v1",
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { kind: "warning", title: null },
            content: [{ type: "paragraph", content: [] }],
          },
        ],
      } as never),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { kind: "warning", title: "", titleTouched: false },
          content: [{ type: "paragraph", content: [] }],
        },
      ],
    });
  });

  it("fails closed for unknown callout kinds and illegal callout children", () => {
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { kind: "future", title: "Future", titleTouched: true },
            content: [{ type: "paragraph" }],
          },
        ],
      }),
    ).toThrow(UnsupportedAIContentError);
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { kind: "tip", title: "Tip", titleTouched: true },
            content: [{ type: "heading", attrs: { level: 2 } }],
          },
        ],
      }),
    ).toThrow();
  });

  it("round-trips the native Proof/QED environment", () => {
    const proof: JSONContent = {
      type: "proof",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "由定義可知 " },
            { type: "inlineMath", attrs: { latex: "L=M" } },
            { type: "text", text: "。" },
          ],
        },
        { type: "blockMath", attrs: { latex: "L=M" } },
      ],
    };
    const ai = tiptapDocumentToAnvilNote({ type: "doc", content: [proof] });
    expect(ai.content[0]?.type).toBe("proof");
    expect(anvilNoteDocumentToTiptap(ai)).toEqual({
      type: "doc",
      content: [proof],
    });
  });

  it("round-trips all three native question kinds and rich choices", () => {
    const baseAttrs = {
      writtenMode: "lines",
      writtenLines: 3,
      writtenHeightPercent: 20,
      writtenHeightCm: null,
      multiForceOneColumn: true,
      stashedChoiceJSON: null,
    };
    const question: JSONContent = {
      type: "question",
      content: [
        {
          type: "questionItem",
          attrs: { ...baseAttrs, kind: "single" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "選出正確敘述。" }],
            },
            {
              type: "choiceList",
              content: [
                {
                  type: "choiceItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "答案 " },
                        { type: "inlineMath", attrs: { latex: "L" } },
                      ],
                    },
                  ],
                },
                {
                  type: "choiceItem",
                  content: [{ type: "blockMath", attrs: { latex: "L=M" } }],
                },
              ],
            },
          ],
        },
        {
          type: "questionItem",
          attrs: {
            ...baseAttrs,
            kind: "multi",
            multiForceOneColumn: false,
          },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "可複選。" }] },
            {
              type: "choiceList",
              content: [
                { type: "choiceItem", content: [{ type: "paragraph", content: [] }] },
                { type: "choiceItem", content: [{ type: "paragraph", content: [] }] },
              ],
            },
          ],
        },
        {
          type: "questionItem",
          attrs: {
            ...baseAttrs,
            kind: "written",
            writtenMode: "blank",
            writtenHeightPercent: 30,
            writtenHeightCm: 7.2,
          },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "請證明。" }] },
          ],
        },
      ],
    };
    const ai = tiptapDocumentToAnvilNote({ type: "doc", content: [question] });
    expect(ai.content[0]?.type).toBe("question");
    expect(anvilNoteDocumentToTiptap(ai)).toEqual({
      type: "doc",
      content: [question],
    });
  });

  it("fails closed for hidden stashed choices and unsupported question content", () => {
    const attrs = {
      kind: "single",
      writtenMode: "lines",
      writtenLines: 3,
      writtenHeightPercent: 20,
      writtenHeightCm: null,
      multiForceOneColumn: true,
      stashedChoiceJSON: JSON.stringify({
        type: "choiceItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hidden" }] }],
      }),
    };
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "question",
            content: [
              {
                type: "questionItem",
                attrs,
                content: [{ type: "paragraph", content: [] }],
              },
            ],
          },
        ],
      }),
    ).toThrow(UnsupportedAIContentError);

    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "question",
            content: [
              {
                type: "questionItem",
                attrs: { ...attrs, stashedChoiceJSON: null },
                content: [
                  { type: "paragraph", content: [] },
                  {
                    type: "choiceList",
                    content: [
                      {
                        type: "choiceItem",
                        content: [{ type: "image", attrs: { src: "x" } }],
                      },
                      { type: "choiceItem", content: [{ type: "paragraph", content: [] }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(UnsupportedAIContentError);
  });

  it("blocks unknown nodes, unsafe marks, and unsupported cell styling without data loss", () => {
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [{ type: "image", attrs: { src: "data:image/png;base64,x" } }],
      }),
    ).toThrow(UnsupportedAIContentError);
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "highlight" }] }] },
        ],
      }),
    ).toThrow(/highlight/);
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    attrs: { colspan: 1, rowspan: 1, colwidth: null, fill: "#ffffff" },
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/fill/);
  });

  it("protects and restores footnote references and cross-references exactly", () => {
    const registry = ProtectedSelectionRegistry.create();
    const fragment = tiptapSelectionToAnvilNote(
      [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "footnoteReference", attrs: { footnoteId: "fn-1", label: "1" } },
            { type: "text", text: " and " },
            { type: "crossRef", attrs: { targetId: "eq-1", targetType: "equation" } },
          ],
        },
      ],
      registry,
    );
    expect(anvilNoteFragmentToTiptap(fragment, registry)).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "See " },
          { type: "footnoteReference", attrs: { footnoteId: "fn-1", label: "1" } },
          { type: "text", text: " and " },
          { type: "crossRef", attrs: { targetId: "eq-1", targetType: "equation" } },
        ],
      },
    ]);
  });

  it("fails closed when protected placeholders are missing or duplicated", () => {
    const registry = ProtectedSelectionRegistry.create();
    const fragment = tiptapSelectionToAnvilNote(
      [
        {
          type: "paragraph",
          content: [{ type: "crossRef", attrs: { targetId: "eq-1" } }],
        },
      ],
      registry,
    );
    expect(() =>
      anvilNoteFragmentToTiptap({ ...fragment, content: [{ type: "paragraph", content: [] }] }, registry),
    ).toThrow(/exactly once/);
    const protectedBlock = fragment.content[0];
    if (protectedBlock.type !== "paragraph" || protectedBlock.content[0]?.type !== "text") {
      throw new Error("Expected a protected paragraph placeholder.");
    }
    const placeholder = protectedBlock.content[0].text;
    expect(() =>
      anvilNoteFragmentToTiptap(
        {
          ...fragment,
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: placeholder },
                { type: "text", text: placeholder },
              ],
            },
          ],
        },
        registry,
      ),
    ).toThrow(/exactly once/);
  });
});
