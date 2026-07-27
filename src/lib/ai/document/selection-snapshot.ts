import type { Editor, JSONContent } from "@tiptap/core";
import { buildEditSnapshot, type EditSnapshotV1 } from "@anvilnote/ai-writer";
import { tiptapDocumentToAiSnapshotSource } from "./converters";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stableDocumentHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export interface SelectionSnapshot {
  requestId: string;
  documentId: string;
  from: number;
  to: number;
  selectedContent: JSONContent[];
  selectedCharacterCount: number;
  selectedFragmentHash: string;
  documentHash: string;
  capturedAt: string;
}

function characterCount(content: JSONContent[]): number {
  let total = 0;
  const visit = (node: JSONContent) => {
    if (node.type === "text") total += node.text?.length ?? 0;
    node.content?.forEach(visit);
  };
  content.forEach(visit);
  return total;
}

export function createSelectionSnapshot(input: {
  requestId: string;
  documentId: string;
  from: number;
  to: number;
  document: JSONContent;
  selectedContent: JSONContent[];
}): SelectionSnapshot {
  return {
    requestId: input.requestId,
    documentId: input.documentId,
    from: input.from,
    to: input.to,
    selectedContent: structuredClone(input.selectedContent),
    selectedCharacterCount: characterCount(input.selectedContent),
    selectedFragmentHash: stableDocumentHash(input.selectedContent),
    documentHash: stableDocumentHash(input.document),
    capturedAt: new Date().toISOString(),
  };
}

export function hasSelectionConflict(
  snapshot: SelectionSnapshot,
  current: { document: JSONContent; selectedContent: JSONContent[] },
): boolean {
  return (
    stableDocumentHash(current.selectedContent) !== snapshot.selectedFragmentHash ||
    stableDocumentHash(current.document) !== snapshot.documentHash
  );
}

// A PartialSelection wholly inside one paragraph serializes its Slice
// content as inline nodes (e.g. [{type:"text",...}]) rather than a block —
// mirrors tiptapSelectionToAnvilNote's own INLINE_SELECTION_NODES wrapping
// in converters.ts, expanded here for the V2 AST's larger inline node set
// (crossRef/footnoteReference/questionBlank/inlineBlank are all genuinely
// editable V2 inline nodes now, unlike the OLD V1 path where they were only
// ever seen via a text placeholder).
const INLINE_NODE_TYPES_V2 = new Set([
  "text",
  "hardBreak",
  "inlineMath",
  "crossRef",
  "footnoteReference",
  "questionBlank",
  "inlineBlank",
]);

// NEW (Task 24.1) — builds a real SHA-256-backed EditSnapshotV1 for just the
// selected range, for the NEW full-structure edit-operations flow. Deliberately
// does NOT reuse stableDocumentHash above (a weak 32-bit FNV-1a hash, kept
// only for the EXISTING createSelectionSnapshot/hasSelectionConflict pair —
// still serving the OLDER compose/rewrite-selection flow, confirmed still
// live via smart-mode-panel.tsx/tiptap-bubble-menu.tsx). `baseSelectionHash`
// instead comes straight from ai-writer's own `buildEditSnapshot`'s
// `baseDocumentHash` (real SHA-256 over canonicalJSONStringify(document) —
// see anvilnote-ai-writer/src/edits/edit-snapshot.ts), exposed here under
// the name Task 24.3's staleness check expects to compare against the API's
// own baseSelectionHash/baseDocumentHash (same hash primitives, per a prior
// Phase 23 task in anvilnote-api).
export function tiptapSelectionToEditSnapshot(
  editor: Editor,
  range: { from: number; to: number },
): { snapshot: EditSnapshotV1; baseSelectionHash: string; range: { from: number; to: number } } {
  const selectedContent = (editor.state.doc.slice(range.from, range.to).content.toJSON() ??
    []) as JSONContent[];
  const blocks =
    selectedContent.length > 0 &&
    selectedContent.every((node) => INLINE_NODE_TYPES_V2.has(node.type ?? ""))
      ? [{ type: "paragraph", content: selectedContent }]
      : selectedContent;
  const source = tiptapDocumentToAiSnapshotSource({ type: "doc", content: blocks });
  const snapshot = buildEditSnapshot(source);
  return { snapshot, baseSelectionHash: snapshot.baseDocumentHash, range };
}
