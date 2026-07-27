import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it, vi } from "vitest";
import { buildExtensions } from "./extensions";
import { fixMisWrappedListItemDrop } from "./list-item-drop-fix";

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
      onListItemDemoteBlocked: () => {},
    }),
    content,
  });
  document.body.appendChild(editor.view.dom);
  return editor;
}

describe("fixMisWrappedListItemDrop", () => {
  it("keeps a dragged item ordered when dropped past its ordered list's last child", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Parent" }] },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [{ type: "paragraph", content: [{ type: "text", text: "dadsd" }] }],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "dsdad" }] }],
            },
          ],
        },
      ],
    });

    try {
      const doc = editor.state.doc;
      const outerList = doc.child(0);
      const from = 1; // "Parent" listItem's own start
      const parentItem = doc.resolve(from).nodeAfter!;
      const to = from + parentItem.nodeSize;
      const dropPos = 1 + outerList.nodeSize - 1; // just past the whole orderedList's last child

      (editor.view as unknown as { dragging: unknown }).dragging = {
        slice: doc.slice(from, to),
        node: NodeSelection.create(doc, from),
      };

      const handled = fixMisWrappedListItemDrop(editor.view, dropPos);
      expect(handled).toBe(true);

      const json = editor.getJSON() as unknown as {
        content?: Array<{ type?: string; content?: Array<{ content?: unknown[] }> }>;
      };
      const lists = json.content?.filter((n) => n.type === "orderedList" || n.type === "bulletList");
      expect(lists).toHaveLength(1);
      expect(lists?.[0].type).toBe("orderedList");
      expect(lists?.[0].content).toHaveLength(2);

      const resultList = editor.state.doc.child(0);
      // "dsdad" (the item that was already last) now comes first, "Parent"
      // (dropped past it) comes second — and Parent's own nested "dadsd"
      // sublist survived the move intact.
      expect(resultList.child(0).textContent).toBe("dsdad");
      expect(resultList.child(1).textContent).toBe("Parentdadsd");
    } finally {
      editor.destroy();
    }
  });

  it("does nothing when there is no dragging state (not a listItem drag)", () => {
    const editor = createEditor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Just text" }] }],
    });
    try {
      (editor.view as unknown as { dragging: unknown }).dragging = null;
      expect(fixMisWrappedListItemDrop(editor.view, 1)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("leaves an already-valid same-list drop position alone", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
            },
          ],
        },
      ],
    });
    try {
      const doc = editor.state.doc;
      const from = 1; // "A" listItem
      const item = doc.resolve(from).nodeAfter!;
      const to = from + item.nodeSize;

      (editor.view as unknown as { dragging: unknown }).dragging = {
        slice: doc.slice(from, to),
        node: NodeSelection.create(doc, from),
      };

      // Drop right at the boundary between "A" and "B" — already directly
      // inside the same orderedList, no ambiguous wrap needed.
      const handled = fixMisWrappedListItemDrop(editor.view, to);
      expect(handled).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});
