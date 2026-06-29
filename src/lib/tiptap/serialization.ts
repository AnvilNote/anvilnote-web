import type { JSONContent } from "@tiptap/core";
import { emptyTiptapContent } from "./default-content";

// IDs of documents whose stored content could not be migrated from a legacy
// (BlockNote) shape and were reset to an empty Tiptap doc. The editor reads and
// clears this on mount to surface a one-time toast.
export const migratedDocIds = new Set<string>();

/** A value is a usable Tiptap document if it's a `doc` node object. */
export function isValidTiptapDoc(value: unknown): value is JSONContent {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as JSONContent).type === "doc"
  );
}

// The API persists `content` as a JSON array (z.array(z.unknown())), so we wrap
// the Tiptap doc as a single-element array on the wire and unwrap it here. This
// keeps the backend contract untouched while the frontend works with a doc.
export function toWireContent(doc: JSONContent): JSONContent[] {
  return [doc];
}

// Normalize whatever the API returned into a valid Tiptap doc.
// - `[doc]`           → our current format, unwrap it.
// - `[]`              → a fresh/empty document, use an empty doc.
// - `[block, …]`      → legacy BlockNote blocks; can't be mapped 1:1, so reset
//                       to an empty doc and report it as migrated.
export function normalizeTiptapContent(raw: unknown): {
  content: JSONContent;
  migrated: boolean;
} {
  if (Array.isArray(raw)) {
    if (isValidTiptapDoc(raw[0])) {
      return { content: raw[0], migrated: false };
    }
    return {
      content: structuredClone(emptyTiptapContent),
      migrated: raw.length > 0,
    };
  }
  // Defensive: a bare doc object should not arrive over the wire, but accept it.
  if (isValidTiptapDoc(raw)) {
    return { content: raw, migrated: false };
  }
  return { content: structuredClone(emptyTiptapContent), migrated: false };
}

export type OutlineItem = { level: number; text: string };

/** Concatenate all text within a node (recursing into its children). */
export function getNodeText(node: JSONContent): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return node.content.map(getNodeText).join("");
  }
  return "";
}

// Walk the Tiptap JSON and collect heading nodes into a flat outline. Headings
// can be nested arbitrarily (e.g. inside a table cell), so the walk recurses.
export function extractOutline(content: JSONContent | undefined): OutlineItem[] {
  const items: OutlineItem[] = [];
  if (!content) return items;

  const walk = (node: JSONContent) => {
    if (node.type === "heading") {
      const text = getNodeText(node).trim();
      if (text) {
        const level =
          typeof node.attrs?.level === "number" ? node.attrs.level : 1;
        items.push({ level, text });
      }
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  };

  walk(content);
  return items;
}
