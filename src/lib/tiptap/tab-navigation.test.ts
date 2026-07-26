import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { buildExtensions } from "./extensions";

function createEditor(content: Record<string, unknown>) {
  const editor = new Editor({
    extensions: buildExtensions({
      placeholder: "Write",
      figureLabel: "Figure",
      tableLabel: "Table",
      figureCaptionPlaceholder: "Caption",
      tableCaptionPlaceholder: "Caption",
      tableDeleteLabel: "Delete",
      tableAddRowLabel: "Add row",
      tableAddColumnLabel: "Add column",
      tableResizeRowLabel: "Resize row",
      tableResizeColumnLabel: "Resize column",
      questionBodyPlaceholder: "Question",
      choicePlaceholder: (label) => `Choice ${label}`,
      tableHeaderPlaceholder: "Header",
      tableCellPlaceholder: "Cell",
      onMathClick: vi.fn(),
    }),
    content,
  });
  document.body.appendChild(editor.view.dom);
  return editor;
}

function textPosition(editor: Editor, text: string): number {
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (position === -1 && node.isText && node.text === text) {
      position = pos + 1;
    }
  });
  if (position === -1) throw new Error(`Missing text node: ${text}`);
  return position;
}

function pressTab(editor: Editor, shiftKey = false) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      bubbles: true,
      cancelable: true,
      shiftKey,
    }),
  );
}

describe("editor Tab behavior", () => {
  it("indents and outdents the current top-level paragraph without moving focus", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second" }] },
      ],
    });

    try {
      const cursor = textPosition(editor, "First");
      editor.commands.setTextSelection(cursor);

      pressTab(editor);

      expect(editor.getJSON().content?.[0]?.attrs).toMatchObject({ indent: 1 });
      expect(editor.state.selection.from).toBe(cursor);

      pressTab(editor, true);

      expect(editor.getJSON().content?.[0]?.attrs).toMatchObject({ indent: 0 });
      expect(editor.state.selection.from).toBe(cursor);
    } finally {
      editor.destroy();
    }
  });

  it("indents and outdents a paragraph inside a callout", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: {
            kind: "note",
            title: "Note",
            titleTouched: false,
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Callout paragraph" }],
            },
          ],
        },
      ],
    });

    try {
      const cursor = textPosition(editor, "Callout paragraph");
      editor.commands.setTextSelection(cursor);
      const paragraphAttrs = () => {
        const document = editor.getJSON() as unknown as {
          content?: Array<{
            type?: string;
            content?: Array<{ attrs?: Record<string, unknown> }>;
          }>;
        };
        return document.content?.find((node) => node.type === "callout")?.content?.[0]?.attrs;
      };

      pressTab(editor);

      expect(paragraphAttrs()).toMatchObject({ indent: 1 });
      expect(editor.state.selection.from).toBe(cursor);

      pressTab(editor, true);

      expect(paragraphAttrs()).toMatchObject({ indent: 0 });
      expect(editor.state.selection.from).toBe(cursor);
    } finally {
      editor.destroy();
    }
  });

  it("nests a list item on Tab instead of navigating to the next text block", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "First item" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Second item" }] },
              ],
            },
          ],
        },
      ],
    });

    try {
      editor.commands.setTextSelection(textPosition(editor, "Second item"));

      pressTab(editor);

      const document = editor.getJSON() as unknown as {
        content?: Array<{ content?: Array<{ content?: unknown[] }> }>;
      };
      const firstItem = document.content?.[0]?.content?.[0];
      expect(firstItem?.content?.[1]).toMatchObject({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Second item" }],
              },
            ],
          },
        ],
      });
    } finally {
      editor.destroy();
    }
  });

  it("nests a list item on Tab inside a callout", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: {
            kind: "note",
            title: "Note",
            titleTouched: false,
          },
          content: [
            {
              type: "orderedList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "First callout item" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Second callout item" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    try {
      editor.commands.setTextSelection(textPosition(editor, "Second callout item"));

      pressTab(editor);

      const document = editor.getJSON() as unknown as {
        content?: Array<{
          type?: string;
          content?: Array<{
            type?: string;
            content?: Array<{ content?: unknown[] }>;
          }>;
        }>;
      };
      const callout = document.content?.find((node) => node.type === "callout");
      const firstItem = callout?.content?.[0]?.content?.[0];
      expect(firstItem?.content?.[1]).toMatchObject({
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Second callout item" }],
              },
            ],
          },
        ],
      });
    } finally {
      editor.destroy();
    }
  });

  it("keeps Tab inside a first list item when there is no previous item to nest under", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Only item" }] },
              ],
            },
          ],
        },
      ],
    });

    try {
      const cursor = textPosition(editor, "Only item") + 4;
      editor.commands.setTextSelection(cursor);
      const before = editor.getJSON();

      pressTab(editor);

      expect(editor.getJSON()).toEqual(before);
      expect(editor.state.selection.from).toBe(cursor);
    } finally {
      editor.destroy();
    }
  });
});
