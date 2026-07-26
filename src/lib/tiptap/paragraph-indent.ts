import { Extension } from "@tiptap/core";

export const MAX_PARAGRAPH_INDENT = 8;

function normalizeIndent(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.trunc(parsed), 0), MAX_PARAGRAPH_INDENT);
}

export const ParagraphIndent = Extension.create({
  name: "paragraphIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => normalizeIndent(element.getAttribute("data-indent")),
            renderHTML: (attributes) => {
              const indent = normalizeIndent(attributes.indent);
              return indent > 0 ? { "data-indent": String(indent) } : {};
            },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    const changeIndent = (delta: number) => {
      const { $from, empty } = this.editor.state.selection;
      if (!empty || $from.depth !== 1 || $from.parent.type.name !== "paragraph") {
        return false;
      }

      const current = normalizeIndent($from.parent.attrs.indent);
      const next = normalizeIndent(current + delta);
      if (next !== current) {
        this.editor.commands.updateAttributes("paragraph", { indent: next });
      }
      return true;
    };

    return {
      Tab: () => changeIndent(1),
      "Shift-Tab": () => changeIndent(-1),
    };
  },
});
