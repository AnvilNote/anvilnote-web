import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { buildExtensions } from "./extensions";
import { demoteLastListItem } from "./list-item-demote";

function createEditor(content: Record<string, unknown>, onListItemDemoteBlocked: () => void) {
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
      onListItemDemoteBlocked,
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

function pressTab(editor: Editor) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      bubbles: true,
      cancelable: true,
    }),
  );
}

function pressTabTwice(editor: Editor) {
  pressTab(editor);
  pressTab(editor);
}

describe("double-Tab list item demote", () => {
  it("strips the marker and merges into the parent when it's the only nested item", () => {
    const onBlocked = vi.fn();
    const editor = createEditor(
      {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
                  {
                    type: "orderedList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B" }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      onBlocked,
    );

    try {
      editor.commands.setTextSelection(textPosition(editor, "Item B"));
      pressTabTwice(editor);

      expect(onBlocked).not.toHaveBeenCalled();
      const document = editor.getJSON() as unknown as {
        content?: Array<{ content?: Array<{ content?: unknown[] }> }>;
      };
      const item = document.content?.[0]?.content?.[0];
      expect(item?.content).toMatchObject([
        { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
        { type: "paragraph", content: [{ type: "text", text: "Item B" }] },
      ]);
    } finally {
      editor.destroy();
    }
  });

  it("keeps the cursor inside the merged text instead of jumping to a later block", () => {
    // Regression: TextSelection.near() defaults to a forward bias, so a
    // naively-mapped cursor position sitting exactly on the node boundary
    // right after "Item B" would jump into whatever textblock comes next
    // — here, a trailing empty paragraph placed right after the list —
    // instead of staying inside the just-merged content.
    const onBlocked = vi.fn();
    const editor = createEditor(
      {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
                  {
                    type: "orderedList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B" }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { type: "paragraph" },
        ],
      },
      onBlocked,
    );

    try {
      const endOfItemB = textPosition(editor, "Item B") + "Item B".length - 1;
      editor.commands.setTextSelection(endOfItemB);
      pressTabTwice(editor);

      expect(onBlocked).not.toHaveBeenCalled();
      const $from = editor.state.selection.$from;
      let insideMergedParagraph = false;
      for (let depth = $from.depth; depth >= 0; depth -= 1) {
        if ($from.node(depth).textContent === "Item B") {
          insideMergedParagraph = true;
          break;
        }
      }
      expect(insideMergedParagraph).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("merges into its immediately preceding sibling when Tab #1 actually sinks it there", () => {
    // Item B2 has a preceding sibling (Item B1) to nest under, so the
    // FIRST Tab of the double-Tab really does sink it (standard, unchanged
    // sinkListItem behavior) before the second Tab ever runs — landing it
    // as B1's own child, not the outer grandparent's.
    const onBlocked = vi.fn();
    const editor = createEditor(
      {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B1" }] },
                        ],
                      },
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B2" }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      onBlocked,
    );

    try {
      editor.commands.setTextSelection(textPosition(editor, "Item B2"));
      pressTabTwice(editor);

      expect(onBlocked).not.toHaveBeenCalled();
      const document = editor.getJSON() as unknown as {
        content?: Array<{ content?: Array<{ content?: unknown[] }> }>;
      };
      const outerItem = document.content?.[0]?.content?.[0];
      const b1Item = (
        outerItem?.content?.[1] as { content?: Array<{ content?: unknown[] }> } | undefined
      )?.content?.[0];
      expect(b1Item?.content).toMatchObject([
        { type: "paragraph", content: [{ type: "text", text: "Item B1" }] },
        { type: "paragraph", content: [{ type: "text", text: "Item B2" }] },
      ]);
    } finally {
      editor.destroy();
    }
  });

  it("(direct) merges only the last item, leaving preceding siblings in the sublist", () => {
    // Exercises the case Tab #1 can't reach on its own: a nested item whose
    // list already has more than one child at the moment of the merge (e.g.
    // it just joined a sibling's EXISTING nested list rather than creating
    // a fresh singleton one). Calling demoteLastListItem directly isolates
    // this from sinkListItem's own join-vs-create-new behavior.
    const onBlocked = vi.fn();
    const editor = createEditor(
      {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B1" }] },
                          {
                            type: "bulletList",
                            content: [
                              {
                                type: "listItem",
                                content: [
                                  {
                                    type: "paragraph",
                                    content: [{ type: "text", text: "Item B1a" }],
                                  },
                                ],
                              },
                              {
                                type: "listItem",
                                content: [
                                  {
                                    type: "paragraph",
                                    content: [{ type: "text", text: "Item B1b" }],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      onBlocked,
    );

    try {
      editor.commands.setTextSelection(textPosition(editor, "Item B1b"));
      const result = demoteLastListItem(editor.view.state, editor.view.dispatch);

      expect(result).toBe("demoted");
      const document = editor.getJSON() as unknown as {
        content?: Array<{ content?: Array<{ content?: unknown[] }> }>;
      };
      const outerItem = document.content?.[0]?.content?.[0];
      const b1Item = (
        outerItem?.content?.[1] as { content?: Array<{ content?: unknown[] }> } | undefined
      )?.content?.[0];
      expect(b1Item?.content).toMatchObject([
        { type: "paragraph", content: [{ type: "text", text: "Item B1" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Item B1a" }] }],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Item B1b" }] },
      ]);
    } finally {
      editor.destroy();
    }
  });

  it("blocks with a toast when the item is top-level", () => {
    const onBlocked = vi.fn();
    const editor = createEditor(
      {
        type: "doc",
        content: [
          {
            type: "orderedList",
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
      },
      onBlocked,
    );

    try {
      editor.commands.setTextSelection(textPosition(editor, "Only item"));
      const before = editor.getJSON();
      pressTabTwice(editor);

      expect(onBlocked).toHaveBeenCalledTimes(1);
      expect(editor.getJSON()).toEqual(before);
    } finally {
      editor.destroy();
    }
  });

  it("blocks with a toast when the nested item is not the last sibling", () => {
    const onBlocked = vi.fn();
    const editor = createEditor(
      {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
                  {
                    type: "orderedList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B1" }] },
                        ],
                      },
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B2" }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      onBlocked,
    );

    try {
      editor.commands.setTextSelection(textPosition(editor, "Item B1"));
      const before = editor.getJSON();
      pressTabTwice(editor);

      expect(onBlocked).toHaveBeenCalledTimes(1);
      expect(editor.getJSON()).toEqual(before);
    } finally {
      editor.destroy();
    }
  });

  it("does not demote on a single Tab press", () => {
    const onBlocked = vi.fn();
    const editor = createEditor(
      {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
                  {
                    type: "orderedList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          { type: "paragraph", content: [{ type: "text", text: "Item B" }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      onBlocked,
    );

    try {
      editor.commands.setTextSelection(textPosition(editor, "Item B"));
      pressTab(editor);

      expect(onBlocked).not.toHaveBeenCalled();
      const document = editor.getJSON() as unknown as {
        content?: Array<{ content?: Array<{ content?: unknown[] }> }>;
      };
      const item = document.content?.[0]?.content?.[0];
      // A lone nested item with no previous sibling has nothing to sink
      // under, so the single Tab is a no-op — it must NOT have been
      // reinterpreted as a demote.
      expect(item?.content?.[1]).toMatchObject({ type: "orderedList" });
    } finally {
      editor.destroy();
    }
  });
});
