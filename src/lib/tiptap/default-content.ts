import type { JSONContent } from "@tiptap/core";

// The starting document for a brand-new note. The H1 and first paragraph are
// seed copy the user immediately overwrites; callers pass localized strings so
// the seed matches the chosen language. Falls back to English.
export function buildDefaultContent(
  heading = "Your lecture starts here",
  body = "Start writing your note here.",
): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: heading }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: body }],
      },
    ],
  };
}

export const defaultTiptapContent: JSONContent = buildDefaultContent();

// A valid-but-empty Tiptap document. Used as the safe fallback whenever stored
// content is missing or incompatible (e.g. legacy BlockNote blocks).
export const emptyTiptapContent: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
