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
