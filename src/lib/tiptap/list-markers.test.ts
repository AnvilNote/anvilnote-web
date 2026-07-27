import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildExtensions } from "./extensions";
import { useSettingsStore } from "@/lib/stores/settings-store";

const DEFAULT_ORDERED = useSettingsStore.getState().orderedListLevels;
const DEFAULT_UNORDERED = useSettingsStore.getState().unorderedListLevels;

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
      onMathClick: () => {},
      onListItemDemoteBlocked: () => {},
    }),
    content,
  });
  document.body.appendChild(editor.view.dom);
  return editor;
}

function orderedDoc(count: number) {
  return {
    type: "doc",
    content: [
      {
        type: "orderedList",
        content: Array.from({ length: count }, (_, i) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Item ${i + 1}` }],
            },
          ],
        })),
      },
    ],
  };
}

describe("list markers: settings-driven modules", () => {
  afterEach(() => {
    useSettingsStore.setState({
      orderedListLevels: DEFAULT_ORDERED,
      unorderedListLevels: DEFAULT_UNORDERED,
    });
  });

  it("changing the settings store repaints already-rendered markers without touching the document", async () => {
    const editor = createEditor(orderedDoc(1));
    // Tiptap fires each extension's onCreate() on the next tick (not
    // synchronously from the Editor constructor), so the settings-store
    // subscription this test is exercising isn't registered yet the instant
    // createEditor() returns. A real, long-lived editor has long since
    // ticked past this by the time a user opens Settings.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const item = editor.view.dom.querySelector("li");
      expect(item?.getAttribute("data-list-marker")).toBe("1.");

      useSettingsStore.getState().setOrderedListLevel(0, "roman-upper");

      expect(item?.getAttribute("data-list-marker")).toBe("I.");
    } finally {
      editor.destroy();
    }
  });

  it("wraps back to level 1 once depth exceeds the configured level count", () => {
    useSettingsStore.setState({ orderedListLevels: ["circled"] });
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Outer" }],
                },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Inner" }],
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
    });
    try {
      const markers = Array.from(editor.view.dom.querySelectorAll("li")).map(
        (item) => item.getAttribute("data-list-marker"),
      );
      // Depth 1 -> "circled" (the only configured level); depth 2 wraps
      // back to the same single level, not a hardcoded fallback.
      expect(markers).toEqual(["①", "①"]);
    } finally {
      editor.destroy();
    }
  });

  it("removing a level shrinks the wrap-around cycle", () => {
    useSettingsStore.setState({ unorderedListLevels: ["▲", "▼"] });
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "One" }] },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Two" }],
                        },
                        {
                          type: "bulletList",
                          content: [
                            {
                              type: "listItem",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "Three" }],
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
    });
    try {
      const markers = Array.from(editor.view.dom.querySelectorAll("li")).map(
        (item) => item.getAttribute("data-list-marker"),
      );
      expect(markers).toEqual(["▲", "▼", "▲"]);
    } finally {
      editor.destroy();
    }
  });
});
