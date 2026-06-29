import type { JSONContent } from "@tiptap/core";

// The starting document for a brand-new note. The visible text is intentionally
// plain English seed copy that the user immediately overwrites; all chrome
// around the editor is localized via next-intl.
export const defaultTiptapContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Untitled Lecture" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Start writing your note here." }],
    },
  ],
};

// A valid-but-empty Tiptap document. Used as the safe fallback whenever stored
// content is missing or incompatible (e.g. legacy BlockNote blocks).
export const emptyTiptapContent: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
