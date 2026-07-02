import type { JSONContent } from "@tiptap/core";

// Flattens a Tiptap document body to plain text for search. `content` is an
// AnvilDocument's `content` field — an unwrapped `doc` node.
export function documentPlainText(content: JSONContent | undefined): string {
  if (!content) return "";
  const walk = (nodes: JSONContent[] | undefined): string =>
    (nodes ?? [])
      .map((node) => (typeof node.text === "string" ? node.text : walk(node.content)))
      .join(" ");
  return walk(content.content);
}
